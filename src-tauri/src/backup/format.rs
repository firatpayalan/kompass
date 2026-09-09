use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::Rng;
use zeroize::Zeroizing;

const MAGIC: &[u8; 4] = b"KMPS";
const FORMAT_VERSION: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const HEADER_LEN: usize = 4 + 1 + SALT_LEN + NONCE_LEN;
const KEY_LEN: usize = 32;

const ERR_WRONG_PASSWORD: &str = "Parola hatalı veya dosya bozuk";
const ERR_UNSUPPORTED: &str = "Desteklenmeyen yedek biçimi";
const ERR_EMPTY_PASSWORD: &str = "Parola boş olamaz";

/// Pack named files and encrypt them as a version-1 `.kompass` blob.
pub fn seal_backup(password: &str, files: &[(String, Vec<u8>)]) -> Result<Vec<u8>, String> {
    if password.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }

    let plaintext = pack_files(files)?;

    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    let mut rng = rand::rng();
    rng.fill_bytes(&mut salt);
    rng.fill_bytes(&mut nonce_bytes);

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref())
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    let nonce = Nonce::from(nonce_bytes);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;

    let mut out = Vec::with_capacity(HEADER_LEN + ciphertext.len());
    out.extend_from_slice(MAGIC);
    out.push(FORMAT_VERSION);
    out.extend_from_slice(&salt);
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Decrypt a `.kompass` blob and unpack the named files.
pub fn open_backup(password: &str, blob: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    if password.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }
    if blob.len() < HEADER_LEN || &blob[..4] != MAGIC || blob[4] != FORMAT_VERSION {
        return Err(ERR_UNSUPPORTED.to_string());
    }

    let salt: [u8; SALT_LEN] = blob[5..5 + SALT_LEN]
        .try_into()
        .map_err(|_| ERR_UNSUPPORTED.to_string())?;
    let nonce_bytes: [u8; NONCE_LEN] = blob[5 + SALT_LEN..HEADER_LEN]
        .try_into()
        .map_err(|_| ERR_UNSUPPORTED.to_string())?;
    let ciphertext = &blob[HEADER_LEN..];

    let key = derive_key(password, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(key.as_ref())
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    let nonce = Nonce::from(nonce_bytes);
    let plaintext = cipher
        .decrypt(&nonce, ciphertext)
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    unpack_files(&plaintext)
}

/// Argon2id v0x13, m=19456 KiB, t=2, p=1, 32-byte AES-256 key.
/// Pinned explicitly so crate-default changes cannot shift the on-disk format.
fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; KEY_LEN]>, String> {
    let params = Params::new(19_456, 2, 1, Some(KEY_LEN))
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = Zeroizing::new([0u8; KEY_LEN]);
    argon2
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    Ok(key)
}

fn pack_files(files: &[(String, Vec<u8>)]) -> Result<Vec<u8>, String> {
    let count = u32::try_from(files.len()).map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
    let mut buf = Vec::new();
    buf.extend_from_slice(&count.to_be_bytes());
    for (name, data) in files {
        let name_bytes = name.as_bytes();
        let name_len = u16::try_from(name_bytes.len()).map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
        buf.extend_from_slice(&name_len.to_be_bytes());
        buf.extend_from_slice(name_bytes);
        let data_len = u64::try_from(data.len()).map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
        buf.extend_from_slice(&data_len.to_be_bytes());
        buf.extend_from_slice(data);
    }
    Ok(buf)
}

fn unpack_files(mut data: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    if data.len() < 4 {
        return Err(ERR_WRONG_PASSWORD.to_string());
    }
    let count = u32::from_be_bytes(data[..4].try_into().unwrap());
    data = &data[4..];
    let mut files = Vec::with_capacity(count as usize);
    for _ in 0..count {
        if data.len() < 2 {
            return Err(ERR_WRONG_PASSWORD.to_string());
        }
        let name_len = u16::from_be_bytes(data[..2].try_into().unwrap()) as usize;
        data = &data[2..];
        if data.len() < name_len {
            return Err(ERR_WRONG_PASSWORD.to_string());
        }
        let name = std::str::from_utf8(&data[..name_len])
            .map_err(|_| ERR_WRONG_PASSWORD.to_string())?
            .to_string();
        data = &data[name_len..];
        if data.len() < 8 {
            return Err(ERR_WRONG_PASSWORD.to_string());
        }
        let data_len = u64::from_be_bytes(data[..8].try_into().unwrap());
        data = &data[8..];
        let data_len = usize::try_from(data_len).map_err(|_| ERR_WRONG_PASSWORD.to_string())?;
        if data.len() < data_len {
            return Err(ERR_WRONG_PASSWORD.to_string());
        }
        let content = data[..data_len].to_vec();
        data = &data[data_len..];
        files.push((name, content));
    }
    if !data.is_empty() {
        return Err(ERR_WRONG_PASSWORD.to_string());
    }
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_preserves_files() {
        let files = vec![
            ("leadership.db".into(), b"SQLite...".to_vec()),
            ("llm_settings.json".into(), br#"{"provider":"claude"}"#.to_vec()),
            ("claude_api_key".into(), b"sk-test".to_vec()),
        ];
        let blob = seal_backup("gizli-parola", &files).expect("seal");
        assert_eq!(&blob[..4], b"KMPS");
        assert_eq!(blob[4], 1);
        let opened = open_backup("gizli-parola", &blob).expect("open");
        assert_eq!(opened, files);
    }

    #[test]
    fn wrong_password_fails() {
        let blob = seal_backup("dogru", &[("a".into(), b"b".to_vec())]).unwrap();
        let err = open_backup("yanlis", &blob).unwrap_err();
        assert!(err.contains("Parola hatalı") || err.contains("bozuk"));
    }

    #[test]
    fn empty_password_rejected() {
        let err = seal_backup("", &[]).unwrap_err();
        assert!(err.contains("Parola boş"));
    }

    #[test]
    fn bad_magic_rejected() {
        let err = open_backup("x", b"XXXX........").unwrap_err();
        assert!(err.contains("Desteklenmeyen") || err.contains("biçimi"));
    }

    #[test]
    fn empty_password_rejected_on_open() {
        let err = open_backup("", b"KMPS........").unwrap_err();
        assert!(err.contains("Parola boş"));
    }

    #[test]
    fn unsupported_version_rejected() {
        let mut blob = b"KMPS".to_vec();
        blob.push(99);
        blob.extend_from_slice(&[0u8; 28]);
        let err = open_backup("parola", &blob).unwrap_err();
        assert!(err.contains("Desteklenmeyen") || err.contains("biçimi"));
    }

    #[test]
    fn truncated_header_rejected() {
        let err = open_backup("parola", b"KMPS\x01").unwrap_err();
        assert!(err.contains("Desteklenmeyen") || err.contains("biçimi"));
    }

    #[test]
    fn empty_archive_roundtrip() {
        let files: Vec<(String, Vec<u8>)> = vec![];
        let blob = seal_backup("parola", &files).expect("seal");
        let opened = open_backup("parola", &blob).expect("open");
        assert_eq!(opened, files);
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let mut blob = seal_backup("parola", &[("a".into(), b"b".to_vec())]).unwrap();
        let last = blob.len() - 1;
        blob[last] ^= 0xff;
        let err = open_backup("parola", &blob).unwrap_err();
        assert!(err.contains("Parola hatalı") || err.contains("bozuk"));
    }
}
