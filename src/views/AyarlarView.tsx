import { useEffect, useState } from "react";
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
    </section>
  );
}
