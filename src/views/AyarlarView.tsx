import { useEffect, useState } from "react";
import {
  coerceModel,
  defaultModel,
  modelsFor,
  type LlmProvider,
} from "../lib/llmModels";
import {
  defaultLlmBridge,
  type LlmBridge,
  type LlmSettings,
} from "../lib/llmBridge";

type AyarlarViewProps = {
  onToast?: (message: string) => void;
  llm?: LlmBridge;
};

const ignoreToast = () => undefined;

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
  });
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
        const provider = loaded.provider;
        setSettings({
          provider,
          model: coerceModel(provider, loaded.model),
        });
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
    const coerced = {
      provider: next.provider,
      model: coerceModel(next.provider, next.model),
    };
    setSettings(coerced);
    try {
      await llm.setLlmSettings(coerced);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Ayarlar kaydedilemedi");
    }
  };

  if (loading) {
    return (
      <section>
        <h1>Ayarlar</h1>
        <p>Yükleniyor…</p>
      </section>
    );
  }

  const modelOptions = modelsFor(settings.provider);

  return (
    <section className="ayarlar-view">
      <h1>Ayarlar</h1>
      <p className="ayarlar-view__privacy">
        Özetle, not metinlerini seçilen sağlayıcıya (Anthropic veya OpenAI)
        gönderir.
      </p>

      <fieldset className="ayarlar-view__fieldset">
        <legend>Claude (Anthropic) API anahtarı</legend>
        {claudeSaved ? (
          <p>Anahtar kayıtlı</p>
        ) : (
          <p>Anahtar yok</p>
        )}
        <label>
          Yeni anahtar
          <input
            autoComplete="off"
            onChange={(event) => setClaudeInput(event.target.value)}
            type="password"
            value={claudeInput}
          />
        </label>
        <div className="ayarlar-view__actions">
          <button
            onClick={() => {
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
            type="button"
          >
            Kaydet
          </button>
          <button
            onClick={() => {
              void (async () => {
                try {
                  await llm.clearClaudeApiKey();
                  setClaudeSaved(false);
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
            type="button"
          >
            Kaldır
          </button>
        </div>
      </fieldset>

      <fieldset className="ayarlar-view__fieldset">
        <legend>OpenAI API anahtarı</legend>
        {openaiSaved ? <p>Anahtar kayıtlı</p> : <p>Anahtar yok</p>}
        <label>
          Yeni anahtar
          <input
            autoComplete="off"
            onChange={(event) => setOpenaiInput(event.target.value)}
            type="password"
            value={openaiInput}
          />
        </label>
        <div className="ayarlar-view__actions">
          <button
            onClick={() => {
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
            type="button"
          >
            Kaydet
          </button>
          <button
            onClick={() => {
              void (async () => {
                try {
                  await llm.clearOpenaiApiKey();
                  setOpenaiSaved(false);
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
            type="button"
          >
            Kaldır
          </button>
        </div>
      </fieldset>

      <fieldset className="ayarlar-view__fieldset">
        <legend>Özet sağlayıcısı</legend>
        <label>
          Sağlayıcı
          <select
            aria-label="Sağlayıcı"
            onChange={(event) => {
              const provider = event.target.value as LlmProvider;
              void persistSettings({
                provider,
                model: defaultModel(provider),
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
        <label>
          Model
          <select
            aria-label="Model"
            onChange={(event) => {
              void persistSettings({
                provider: settings.provider,
                model: event.target.value,
              });
            }}
            value={settings.model}
          >
            {modelOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
    </section>
  );
}
