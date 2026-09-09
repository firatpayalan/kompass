// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AyarlarView from "../src/views/AyarlarView";

afterEach(cleanup);

const llm = {
  hasClaudeApiKey: vi.fn().mockResolvedValue(false),
  hasOpenaiApiKey: vi.fn().mockResolvedValue(false),
  saveClaudeApiKey: vi.fn(),
  clearClaudeApiKey: vi.fn(),
  saveOpenaiApiKey: vi.fn(),
  clearOpenaiApiKey: vi.fn(),
  getLlmSettings: vi.fn().mockResolvedValue({
    provider: "claude",
    model: "claude-sonnet-4-20250514",
    baseUrl: "",
  }),
  setLlmSettings: vi.fn(),
};

function mockBackup(
  partial: Record<string, unknown> = {},
): {
  pickExportPath: ReturnType<typeof vi.fn>;
  pickImportPath: ReturnType<typeof vi.fn>;
  exportBackup: ReturnType<typeof vi.fn>;
  importBackup: ReturnType<typeof vi.fn>;
  verifyBackupPassword: ReturnType<typeof vi.fn>;
  checkpointDb: ReturnType<typeof vi.fn>;
  closeLiveDb: ReturnType<typeof vi.fn>;
  checkpointAndCloseDb: ReturnType<typeof vi.fn>;
  resetAfterImport: ReturnType<typeof vi.fn>;
  reconnectDb: ReturnType<typeof vi.fn>;
  reloadApp: ReturnType<typeof vi.fn>;
} {
  return {
    pickExportPath: vi.fn().mockResolvedValue("/tmp/t.kompass"),
    pickImportPath: vi.fn().mockResolvedValue("/tmp/t.kompass"),
    exportBackup: vi.fn().mockResolvedValue(undefined),
    importBackup: vi.fn().mockResolvedValue(undefined),
    verifyBackupPassword: vi.fn().mockResolvedValue(undefined),
    checkpointDb: vi.fn().mockResolvedValue(undefined),
    closeLiveDb: vi.fn().mockResolvedValue(undefined),
    checkpointAndCloseDb: vi.fn().mockResolvedValue(undefined),
    resetAfterImport: vi.fn().mockResolvedValue(undefined),
    reconnectDb: vi.fn().mockResolvedValue(undefined),
    reloadApp: vi.fn(),
    ...partial,
  };
}

async function renderAyarlar(
  backup: ReturnType<typeof mockBackup>,
  onToast = vi.fn(),
) {
  render(
    <AyarlarView llm={llm as never} backup={backup as never} onToast={onToast} />,
  );
  expect(await screen.findByRole("heading", { name: "Yedek" })).toBeTruthy();
  return onToast;
}

describe("Ayarlar Yedek", () => {
  it("exports after matching passwords", async () => {
    const backup = mockBackup();
    await renderAyarlar(backup);
    fireEvent.change(screen.getByLabelText("Yedek parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.change(screen.getByLabelText("Yedek parolası (tekrar)"), {
      target: { value: "sifre123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dışa aktar" }));
    await waitFor(() => {
      expect(backup.exportBackup).toHaveBeenCalledWith(
        "sifre123",
        "/tmp/t.kompass",
      );
    });
    expect(backup.checkpointDb).toHaveBeenCalled();
    expect(backup.closeLiveDb).not.toHaveBeenCalled();
    expect(backup.checkpointDb.mock.invocationCallOrder[0]).toBeLessThan(
      backup.exportBackup.mock.invocationCallOrder[0],
    );
  });

  it("does not export when passwords do not match", async () => {
    const backup = mockBackup();
    const onToast = await renderAyarlar(backup);
    fireEvent.change(screen.getByLabelText("Yedek parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.change(screen.getByLabelText("Yedek parolası (tekrar)"), {
      target: { value: "baska" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dışa aktar" }));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalled();
    });
    expect(backup.pickExportPath).not.toHaveBeenCalled();
    expect(backup.exportBackup).not.toHaveBeenCalled();
  });

  it("confirms before import", async () => {
    const backup = mockBackup();
    const onToast = vi.fn();
    await renderAyarlar(backup, onToast);
    fireEvent.change(screen.getByLabelText("İçe aktarım parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İçe aktar" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Yedeği içe aktar" }),
    ).toBeTruthy();
    expect(dialog.textContent).toMatch(/veriler|ayarlar/i);
    expect(backup.importBackup).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "İçe aktar" }));
    await waitFor(() => {
      expect(backup.importBackup).toHaveBeenCalledWith(
        "sifre123",
        "/tmp/t.kompass",
      );
    });
    expect(backup.verifyBackupPassword).toHaveBeenCalledWith(
      "sifre123",
      "/tmp/t.kompass",
    );
    expect(backup.closeLiveDb).toHaveBeenCalled();
    expect(backup.resetAfterImport).toHaveBeenCalled();
    expect(backup.verifyBackupPassword.mock.invocationCallOrder[0]).toBeLessThan(
      backup.closeLiveDb.mock.invocationCallOrder[0],
    );
    expect(backup.closeLiveDb.mock.invocationCallOrder[0]).toBeLessThan(
      backup.importBackup.mock.invocationCallOrder[0],
    );
    expect(backup.importBackup.mock.invocationCallOrder[0]).toBeLessThan(
      backup.resetAfterImport.mock.invocationCallOrder[0],
    );
  });

  it("does not close the live DB when the backup password is wrong", async () => {
    const backup = mockBackup({
      verifyBackupPassword: vi
        .fn()
        .mockRejectedValue("Parola hatalı veya dosya bozuk"),
    });
    const onToast = await renderAyarlar(backup);
    fireEvent.change(screen.getByLabelText("İçe aktarım parolası"), {
      target: { value: "yanlis" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İçe aktar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "İçe aktar" }));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Parola hatalı veya dosya bozuk");
    });
    expect(backup.verifyBackupPassword).toHaveBeenCalledWith(
      "yanlis",
      "/tmp/t.kompass",
    );
    expect(backup.closeLiveDb).not.toHaveBeenCalled();
    expect(backup.checkpointAndCloseDb).not.toHaveBeenCalled();
    expect(backup.importBackup).not.toHaveBeenCalled();
    expect(backup.resetAfterImport).not.toHaveBeenCalled();
    expect(backup.reconnectDb).not.toHaveBeenCalled();
    expect(backup.reloadApp).not.toHaveBeenCalled();
  });

  it("reconnects and rebinds App when import fails after a successful verify", async () => {
    const backup = mockBackup({
      importBackup: vi.fn().mockRejectedValue("Dosya yazılamadı: disk"),
    });
    const onToast = await renderAyarlar(backup);
    fireEvent.change(screen.getByLabelText("İçe aktarım parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İçe aktar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "İçe aktar" }));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Dosya yazılamadı: disk");
    });
    expect(backup.closeLiveDb).toHaveBeenCalled();
    expect(backup.resetAfterImport).not.toHaveBeenCalled();
    expect(backup.reconnectDb).toHaveBeenCalled();
    expect(backup.reloadApp).toHaveBeenCalled();
    expect(backup.reconnectDb.mock.invocationCallOrder[0]).toBeLessThan(
      backup.reloadApp.mock.invocationCallOrder[0],
    );
  });
});
