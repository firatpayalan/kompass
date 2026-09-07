use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CLAUDE_KEY_FILE: &str = "claude_api_key";
const OPENAI_KEY_FILE: &str = "openai_api_key";
const SETTINGS_FILE: &str = "llm_settings.json";
const DEFAULT_CLAUDE_MODEL: &str = "claude-sonnet-4-20250514";
const DEFAULT_OPENAI_MODEL: &str = "gpt-4.1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LlmProvider {
    Claude,
    Openai,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettings {
    pub provider: LlmProvider,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummarizeResult {
    pub content: String,
    pub provider: LlmProvider,
    pub model: String,
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Yapılandırma klasörü açılamadı: {e}"))
}

fn ensure_config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = config_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| format!("Klasör oluşturulamadı: {e}"))?;
    Ok(dir)
}

fn read_key_file(app: &AppHandle, name: &str) -> Result<Option<String>, String> {
    let path = config_dir(app)?.join(name);
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Anahtar okunamadı: {e}"))?;
    let trimmed = raw.trim().to_string();
    if trimmed.is_empty() {
        Ok(None)
    } else {
        Ok(Some(trimmed))
    }
}

fn write_key_file(app: &AppHandle, name: &str, key: &str) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API anahtarı boş olamaz".into());
    }
    let dir = ensure_config_dir(app)?;
    fs::write(dir.join(name), trimmed).map_err(|e| format!("Anahtar yazılamadı: {e}"))
}

fn clear_key_file(app: &AppHandle, name: &str) -> Result<(), String> {
    let path = config_dir(app)?.join(name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Anahtar silinemedi: {e}"))?;
    }
    Ok(())
}

fn default_settings() -> LlmSettings {
    LlmSettings {
        provider: LlmProvider::Claude,
        model: DEFAULT_CLAUDE_MODEL.to_string(),
        base_url: String::new(),
    }
}

fn normalize_base_url(raw: &str) -> String {
    let trimmed = raw.trim();
    trimmed.strip_suffix('/').unwrap_or(trimmed).to_string()
}

fn validate_base_url(raw: &str) -> Result<String, String> {
    let normalized = normalize_base_url(raw);
    if normalized.is_empty() {
        return Ok(normalized);
    }
    if !(normalized.starts_with("http://") || normalized.starts_with("https://")) {
        return Err("API taban adresi http veya https olmalı".into());
    }
    Ok(normalized)
}

fn resolve_endpoint(provider: &LlmProvider, base_url: &str) -> String {
    let base = {
        let n = normalize_base_url(base_url);
        if n.is_empty() {
            match provider {
                LlmProvider::Claude => "https://api.anthropic.com".to_string(),
                LlmProvider::Openai => "https://api.openai.com".to_string(),
            }
        } else {
            n
        }
    };
    let path = match provider {
        LlmProvider::Claude => "/v1/messages",
        LlmProvider::Openai => "/v1/chat/completions",
    };
    format!("{base}{path}")
}

fn read_settings(app: &AppHandle) -> Result<LlmSettings, String> {
    let path = config_dir(app)?.join(SETTINGS_FILE);
    if !path.exists() {
        return Ok(default_settings());
    }
    let raw = fs::read_to_string(&path).map_err(|e| format!("Ayarlar okunamadı: {e}"))?;
    serde_json::from_str(&raw).map_err(|e| format!("Ayarlar bozuk: {e}"))
}

fn write_settings(app: &AppHandle, settings: &LlmSettings) -> Result<(), String> {
    let dir = ensure_config_dir(app)?;
    let raw = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Ayarlar yazılamadı: {e}"))?;
    fs::write(dir.join(SETTINGS_FILE), raw).map_err(|e| format!("Ayarlar yazılamadı: {e}"))
}

#[tauri::command]
pub fn has_claude_api_key(app: AppHandle) -> Result<bool, String> {
    Ok(read_key_file(&app, CLAUDE_KEY_FILE)?.is_some())
}

#[tauri::command]
pub fn save_claude_api_key(app: AppHandle, key: String) -> Result<(), String> {
    write_key_file(&app, CLAUDE_KEY_FILE, &key)
}

#[tauri::command]
pub fn clear_claude_api_key(app: AppHandle) -> Result<(), String> {
    clear_key_file(&app, CLAUDE_KEY_FILE)
}

#[tauri::command]
pub fn has_openai_api_key(app: AppHandle) -> Result<bool, String> {
    Ok(read_key_file(&app, OPENAI_KEY_FILE)?.is_some())
}

#[tauri::command]
pub fn save_openai_api_key(app: AppHandle, key: String) -> Result<(), String> {
    write_key_file(&app, OPENAI_KEY_FILE, &key)
}

#[tauri::command]
pub fn clear_openai_api_key(app: AppHandle) -> Result<(), String> {
    clear_key_file(&app, OPENAI_KEY_FILE)
}

#[tauri::command]
pub fn get_llm_settings(app: AppHandle) -> Result<LlmSettings, String> {
    read_settings(&app)
}

#[tauri::command]
pub fn set_llm_settings(app: AppHandle, settings: LlmSettings) -> Result<(), String> {
    let base_url = validate_base_url(&settings.base_url)?;
    write_settings(
        &app,
        &LlmSettings {
            provider: settings.provider,
            model: settings.model,
            base_url,
        },
    )
}

fn build_prompt(week_start: &str, notes_json: &str) -> String {
    format!(
        r#"Sen bir liderlik asistanısın. Aşağıdaki haftalık notları Türkçe özetle.
Hafta başlangıcı (Pazartesi): {week_start}

Çıktı bölümleri:
1) Kişiler
2) İşler
3) Dikkat / aksiyon

Sadece verilen notlara dayan. Uydurma. Görsel veya teknik işaretleri yok say.

Notlar (JSON):
{notes_json}"#
    )
}

async fn call_claude(
    api_key: &str,
    model: &str,
    prompt: &str,
    endpoint: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "max_tokens": 2048,
        "messages": [{ "role": "user", "content": prompt }]
    });
    let response = client
        .post(endpoint)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Claude isteği başarısız: {e}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("Claude yanıtı okunamadı: {e}"))?;

    if status.as_u16() == 401 {
        return Err("Claude API anahtarı geçersiz".into());
    }
    if !status.is_success() {
        return Err(format!("Claude hatası ({status}): {text}"));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Claude JSON bozuk: {e}"))?;
    parsed["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|block| block["text"].as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Claude yanıtında metin yok".into())
}

async fn call_openai(
    api_key: &str,
    model: &str,
    prompt: &str,
    endpoint: &str,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "Türkçe liderlik özeti üreten bir asistansın." },
            { "role": "user", "content": prompt }
        ]
    });
    let response = client
        .post(endpoint)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("OpenAI isteği başarısız: {e}"))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("OpenAI yanıtı okunamadı: {e}"))?;

    if status.as_u16() == 401 {
        return Err("OpenAI API anahtarı geçersiz".into());
    }
    if !status.is_success() {
        return Err(format!("OpenAI hatası ({status}): {text}"));
    }

    let parsed: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("OpenAI JSON bozuk: {e}"))?;
    parsed["choices"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|c| c["message"]["content"].as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "OpenAI yanıtında metin yok".into())
}

#[tauri::command]
pub async fn summarize_week(
    app: AppHandle,
    week_start: String,
    notes_json: String,
) -> Result<SummarizeResult, String> {
    let settings = read_settings(&app)?;
    let prompt = build_prompt(&week_start, &notes_json);
    let endpoint = resolve_endpoint(&settings.provider, &settings.base_url);

    let (content, model) = match settings.provider {
        LlmProvider::Claude => {
            let key = read_key_file(&app, CLAUDE_KEY_FILE)?
                .ok_or_else(|| "Claude API anahtarı yok. Ayarlar’dan ekleyin.".to_string())?;
            let model = if settings.model.is_empty() {
                DEFAULT_CLAUDE_MODEL.to_string()
            } else {
                settings.model.clone()
            };
            let content = call_claude(&key, &model, &prompt, &endpoint).await?;
            (content, model)
        }
        LlmProvider::Openai => {
            let key = read_key_file(&app, OPENAI_KEY_FILE)?
                .ok_or_else(|| "OpenAI API anahtarı yok. Ayarlar’dan ekleyin.".to_string())?;
            let model = if settings.model.is_empty() {
                DEFAULT_OPENAI_MODEL.to_string()
            } else {
                settings.model.clone()
            };
            let content = call_openai(&key, &model, &prompt, &endpoint).await?;
            (content, model)
        }
    };

    Ok(SummarizeResult {
        content,
        provider: settings.provider,
        model,
    })
}
