import { useEffect, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import {
  defaultBackupBridge,
  type BackupBridge,
} from "../lib/backupBridge";
import { formatError } from "../lib/formatError";
import { normalizeBaseUrl, validateBaseUrl } from "../lib/llmBaseUrl";
import {
  defaultLlmBridge,
  type LlmBridge,
  type LlmSettings,
} from "../lib/llmBridge";
import {
  defaultModel,
  modelsFor,
  normalizeModelId,
  type LlmProvider,
} from "../lib/llmModels";

type AyarlarViewProps = {
  onToast?: (message: string) => void;
  llm?: LlmBridge;
  backup?: BackupBridge;
};

const ignoreToast = () => undefined;

function KeyCard({
  title,
  saved,
  input,
  onInput,
  onSave,
  onClear,
  inputId,
}: {
  title: string;
  saved: boolean;
  input: string;
  onInput: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
  inputId: string;
}) {
  return (
    <section className="ayarlar-card">
      <div className="ayarlar-card__header">
        <h2>{title}</h2>
        <span
          className={
            saved
              ? "ayarlar-card__badge ayarlar-card__badge--ok"
              : "ayarlar-card__badge"
          }
        >
          {saved ? "Kayıtlı" : "Yok"}
        </span>
      </div>
      <label className="ayarlar-card__field" htmlFor={inputId}>
        Yeni anahtar
        <input
          autoComplete="off"
          id={inputId}
          onChange={(event) => onInput(event.target.value)}
          placeholder="sk-…"
          type="password"
          value={input}
        />
      </label>
      <div className="ayarlar-card__actions">
        <button
          className="ayarlar-card__btn ayarlar-card__btn--primary"
          onClick={onSave}
          type="button"
        >
          Kaydet
        </button>
        <button
          className="ayarlar-card__btn"
          disabled={!saved && !input}
          onClick={onClear}
          type="button"
        >
          Kaldır
        </button>
      </div>
    </section>
  );
}

export default function AyarlarView({
  onToast = ignoreToast,
  llm = defaultLlmBridge,
  backup = defaultBackupBridge,
}: AyarlarViewProps) {
  const [claudeSaved, setClaudeSaved] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [claudeInput, setClaudeInput] = useState("");
  const [openaiInput, setOpenaiInput] = useState("");
  const [settings, setSettings] = useState<LlmSettings>({
    provider: "claude",
    model: defaultModel("claude"),
    baseUrl: "",
  });
  const [modelDraft, setModelDraft] = useState(defaultModel("claude"));
  const [baseUrlDraft, setBaseUrlDraft] = useState("");
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportPassword, setExportPassword] = useState("");
  const [exportPasswordConfirm, setExportPasswordConfirm] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [importPath, setImportPath] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [hasClaude, hasOpenai, loaded] = await Promise.all([
          llm.hasClaudeApiKey(),
          llm.hasOpenaiApiKey(),
          llm.getLlmSettings(),
        ]);
        if (!active) return;
        setClaudeSaved(hasClaude);
        setOpenaiSaved(hasOpenai);
        const next = {
          provider: loaded.provider,
          model: normalizeModelId(loaded.model) || defaultModel(loaded.provider),
          baseUrl: loaded.baseUrl ?? "",
        };
        setSettings(next);
        setModelDraft(next.model);
        setBaseUrlDraft(next.baseUrl);
      } catch {
        if (active) onToast("Ayarlar yüklenemedi");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [llm, onToast]);

  const persistSettings = async (next: LlmSettings) => {
    const model = normalizeModelId(next.model) || defaultModel(next.provider);
    const baseUrl = normalizeBaseUrl(next.baseUrl ?? "");
    const error = validateBaseUrl(baseUrl);
    if (error) {
      setBaseUrlError(error);
      onToast(error);
      return;
    }
    setBaseUrlError(null);
    const coerced = { provider: next.provider, model, baseUrl };
    setSettings(coerced);
    setModelDraft(model);
    setBaseUrlDraft(baseUrl);
    try {
      await llm.setLlmSettings(coerced);
    } catch (error) {
      onToast(formatError(error, "Ayarlar kaydedilemedi"));
    }
  };

  const exportYedek = async () => {
    if (!exportPassword) {
      onToast("Parola boş olamaz");
      return;
    }
    if (exportPassword !== exportPasswordConfirm) {
      onToast("Parolalar eşleşmiyor");
      return;
    }
    setBackupBusy(true);
    try {
      await backup.checkpointDb();
      const destPath = await backup.pickExportPath();
      if (!destPath) return;
      await backup.exportBackup(exportPassword, destPath);
      setExportPassword("");
      setExportPasswordConfirm("");
      onToast("Yedek kaydedildi");
    } catch (error) {
      onToast(formatError(error, "Yedek kaydedilemedi"));
    } finally {
      setBackupBusy(false);
    }
  };

  const startImportYedek = async () => {
    if (!importPassword) {
      onToast("Parola boş olamaz");
      return;
    }
    setBackupBusy(true);
    try {
      const sourcePath = await backup.pickImportPath();
      if (!sourcePath) return;
      setImportPath(sourcePath);
    } catch (error) {
      onToast(formatError(error, "Yedek dosyası seçilemedi"));
    } finally {
      setBackupBusy(false);
    }
  };

  const confirmImportYedek = async () => {
    const sourcePath = importPath;
    if (!sourcePath) return;
    setImportPath(null);
    setBackupBusy(true);
    let closed = false;
    try {
      await backup.verifyBackupPassword(importPassword, sourcePath);
      await backup.closeLiveDb();
      closed = true;
      await backup.importBackup(importPassword, sourcePath);
      onToast("Yedek içe aktarıldı");
      await backup.resetAfterImport();
    } catch (error) {
      onToast(formatError(error, "Yedek içe aktarılamadı"));
      if (closed) {
        try {
          await backup.reconnectDb();
          backup.reloadApp();
        } catch (reconnectError) {
          onToast(formatError(reconnectError, "Veritabanı yeniden açılamadı"));
        }
      }
    } finally {
      setBackupBusy(false);
    }
  };

  if (loading) {
    return (
      <section className="ayarlar-view">
        <h1>Ayarlar</h1>
        <p>Yükleniyor…</p>
      </section>
    );
  }

  const suggestions = modelsFor(settings.provider);
  const datalistId = `llm-model-suggestions-${settings.provider}`;

  return (
    <section className="ayarlar-view">
      <header className="ayarlar-view__header">
        <h1>Ayarlar</h1>
        <p className="ayarlar-view__lede">
          Özetle, not metinlerini seçilen sağlayıcıya (Anthropic veya OpenAI)
          gönderir.
        </p>
      </header>

      <div className="ayarlar-view__grid">
        <KeyCard
          input={claudeInput}
          inputId="claude-api-key"
          onClear={() => {
            void (async () => {
              try {
                await llm.clearClaudeApiKey();
                setClaudeSaved(false);
                setClaudeInput("");
                onToast("Claude anahtarı kaldırıldı");
              } catch (error) {
                onToast(
                  error instanceof Error
                    ? error.message
                    : "Claude anahtarı kaldırılamadı",
                );
              }
            })();
          }}
          onInput={setClaudeInput}
          onSave={() => {
            void (async () => {
              try {
                await llm.saveClaudeApiKey(claudeInput);
                setClaudeSaved(true);
                setClaudeInput("");
                onToast("Claude anahtarı kaydedildi");
              } catch (error) {
                onToast(
                  error instanceof Error
                    ? error.message
                    : "Claude anahtarı kaydedilemedi",
                );
              }
            })();
          }}
          saved={claudeSaved}
          title="Claude (Anthropic)"
        />

        <KeyCard
          input={openaiInput}
          inputId="openai-api-key"
          onClear={() => {
            void (async () => {
              try {
                await llm.clearOpenaiApiKey();
                setOpenaiSaved(false);
                setOpenaiInput("");
                onToast("OpenAI anahtarı kaldırıldı");
              } catch (error) {
                onToast(
                  error instanceof Error
                    ? error.message
                    : "OpenAI anahtarı kaldırılamadı",
                );
              }
            })();
          }}
          onInput={setOpenaiInput}
          onSave={() => {
            void (async () => {
              try {
                await llm.saveOpenaiApiKey(openaiInput);
                setOpenaiSaved(true);
                setOpenaiInput("");
                onToast("OpenAI anahtarı kaydedildi");
              } catch (error) {
                onToast(
                  error instanceof Error
                    ? error.message
                    : "OpenAI anahtarı kaydedilemedi",
                );
              }
            })();
          }}
          saved={openaiSaved}
          title="OpenAI"
        />
      </div>

      <section className="ayarlar-card ayarlar-card--wide">
        <div className="ayarlar-card__header">
          <h2>Özet sağlayıcısı</h2>
        </div>
        <label className="ayarlar-card__field" htmlFor="llm-provider">
          Sağlayıcı
          <select
            aria-label="Sağlayıcı"
            id="llm-provider"
            onChange={(event) => {
              const provider = event.target.value as LlmProvider;
              void persistSettings({
                ...settings,
                provider,
                model: defaultModel(provider),
                baseUrl: baseUrlDraft,
              });
            }}
            value={settings.provider}
          >
            <option disabled={!claudeSaved} value="claude">
              Claude{!claudeSaved ? " (anahtar yok)" : ""}
            </option>
            <option disabled={!openaiSaved} value="openai">
              OpenAI{!openaiSaved ? " (anahtar yok)" : ""}
            </option>
          </select>
        </label>
        <label className="ayarlar-card__field" htmlFor="llm-model">
          Model kimliği
          <input
            aria-label="Model"
            autoComplete="off"
            id="llm-model"
            list={datalistId}
            onBlur={() => {
              if (normalizeModelId(modelDraft) === settings.model) return;
              void persistSettings({
                ...settings,
                model: modelDraft,
                baseUrl: baseUrlDraft,
              });
            }}
            onChange={(event) => setModelDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              void persistSettings({
                ...settings,
                model: modelDraft,
                baseUrl: baseUrlDraft,
              });
            }}
            placeholder={defaultModel(settings.provider)}
            spellCheck={false}
            type="text"
            value={modelDraft}
          />
        </label>
        <datalist id={datalistId}>
          {suggestions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </datalist>
        <p className="ayarlar-card__hint">
          İstediğin model id’sini yazabilirsin. Öneriler listeden seçilebilir;
          Enter veya alandan çıkınca kaydedilir.
        </p>
        <label className="ayarlar-card__field" htmlFor="llm-base-url">
          API taban adresi
          <input
            autoComplete="off"
            id="llm-base-url"
            onBlur={() => {
              void persistSettings({
                ...settings,
                model: modelDraft,
                baseUrl: baseUrlDraft,
              });
            }}
            onChange={(event) => {
              setBaseUrlDraft(event.target.value);
              setBaseUrlError(null);
            }}
            placeholder="Boş = resmi API (Anthropic / OpenAI)"
            spellCheck={false}
            value={baseUrlDraft}
          />
        </label>
        {baseUrlError ? (
          <p className="form-error" role="alert">
            {baseUrlError}
          </p>
        ) : null}
        <p className="ayarlar-card__hint">
          Şirket adresi yazabilirsin (path prefix dahil). /v1/... yolunu ekleme;
          seçilen sağlayıcıya göre uygulama ekler.
        </p>
        <div className="ayarlar-card__chips" aria-label="Önerilen modeller">
          {suggestions.map((option) => (
            <button
              className={
                modelDraft === option.id
                  ? "ayarlar-chip ayarlar-chip--active"
                  : "ayarlar-chip"
              }
              key={option.id}
              onClick={() => {
                setModelDraft(option.id);
                void persistSettings({
                  ...settings,
                  model: option.id,
                  baseUrl: baseUrlDraft,
                });
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="ayarlar-card ayarlar-card--wide">
        <div className="ayarlar-card__header">
          <h2>Yedek</h2>
        </div>
        <p className="ayarlar-card__hint">
          Yedek şifreli .kompass dosyasıdır; notları, ayarları ve API
          anahtarlarını da içerir.
        </p>
        <label className="ayarlar-card__field" htmlFor="backup-export-password">
          Yedek parolası
          <input
            aria-label="Yedek parolası"
            autoComplete="new-password"
            id="backup-export-password"
            onChange={(event) => setExportPassword(event.target.value)}
            type="password"
            value={exportPassword}
          />
        </label>
        <label
          className="ayarlar-card__field"
          htmlFor="backup-export-password-confirm"
        >
          Yedek parolası (tekrar)
          <input
            aria-label="Yedek parolası (tekrar)"
            autoComplete="new-password"
            id="backup-export-password-confirm"
            onChange={(event) => setExportPasswordConfirm(event.target.value)}
            type="password"
            value={exportPasswordConfirm}
          />
        </label>
        <div className="ayarlar-card__actions">
          <button
            className="ayarlar-card__btn ayarlar-card__btn--primary"
            disabled={backupBusy}
            onClick={() => void exportYedek()}
            type="button"
          >
            Dışa aktar
          </button>
        </div>
        <div className="ayarlar-card__divider" />
        <label className="ayarlar-card__field" htmlFor="backup-import-password">
          İçe aktarım parolası
          <input
            aria-label="İçe aktarım parolası"
            autoComplete="off"
            id="backup-import-password"
            onChange={(event) => setImportPassword(event.target.value)}
            type="password"
            value={importPassword}
          />
        </label>
        <div className="ayarlar-card__actions">
          <button
            className="ayarlar-card__btn ayarlar-card__btn--primary"
            disabled={backupBusy}
            onClick={() => void startImportYedek()}
            type="button"
          >
            İçe aktar
          </button>
        </div>
      </section>

      {importPath ? (
        <ConfirmDialog
          confirmLabel="İçe aktar"
          message="Bu makinedeki mevcut veriler ve ayarlar yedektekiyle değiştirilecek."
          onCancel={() => setImportPath(null)}
          onConfirm={() => void confirmImportYedek()}
          title="Yedeği içe aktar"
        />
      ) : null}
    </section>
  );
}
