"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { api, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, ErrorNote, Input, Label, Select } from "@/components/ui/primitives";

interface Settings {
  theme: "SYSTEM" | "DARK" | "LIGHT";
  dailyGoal: number;
  preferredDifficulty: string | null;
  defaultSelectionMode: "NEW" | "WEAK" | "MIXED";
  recentWindowHours: number;
  timeZone: string;
}

function useSubmit() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  async function run(fn: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      await fn();
      setSaved(okMessage);
    } catch (e) {
      if (e instanceof ApiError) {
        const d = e.details as Record<string, string> | undefined;
        setError(d && typeof d === "object" ? `${e.message}: ${Object.values(d).join(" ")}` : e.message);
      } else setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, saved, run };
}

export function PreferencesForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [s, setS] = useState(initial);
  const { busy, error, saved, run } = useSubmit();
  const detected = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Study preferences</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("/api/settings", { method: "PATCH", body: s });
            setTheme(s.theme === "SYSTEM" ? "system" : s.theme.toLowerCase());
            router.refresh();
          }, "Preferences saved.");
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="s-goal">Daily goal (answers)</Label>
            <Input id="s-goal" type="number" min={1} max={500} value={s.dailyGoal} onChange={(e) => setS({ ...s, dailyGoal: Number(e.target.value) })} />
          </div>
          <div>
            <Label htmlFor="s-mode">Default quiz mode</Label>
            <Select id="s-mode" value={s.defaultSelectionMode} onChange={(e) => setS({ ...s, defaultSelectionMode: e.target.value as Settings["defaultSelectionMode"] })}>
              <option value="NEW">New questions</option>
              <option value="WEAK">Review weak topics</option>
              <option value="MIXED">Mixed practice</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="s-recent">Hold back recently answered questions for</Label>
            <Select id="s-recent" value={s.recentWindowHours} onChange={(e) => setS({ ...s, recentWindowHours: Number(e.target.value) })}>
              <option value={0}>Don't hold back</option>
              <option value={6}>6 hours</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </Select>
            <p className="mt-1 text-xs text-muted">Only applies while enough other questions are available.</p>
          </div>
          <div>
            <Label htmlFor="s-theme">Theme</Label>
            <Select id="s-theme" value={s.theme} onChange={(e) => setS({ ...s, theme: e.target.value as Settings["theme"] })}>
              <option value="DARK">Dark</option>
              <option value="LIGHT">Light</option>
              <option value="SYSTEM">Match system</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="s-tz">Time zone (for streaks and daily goal)</Label>
            <div className="flex gap-2">
              <Input id="s-tz" value={s.timeZone} onChange={(e) => setS({ ...s, timeZone: e.target.value })} />
              {detected !== s.timeZone ? <Button type="button" variant="secondary" onClick={() => setS({ ...s, timeZone: detected })}>Use {detected}</Button> : null}
            </div>
          </div>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {saved ? <p className="text-sm text-good" role="status">{saved}</p> : null}
        <Button type="submit" loading={busy}>Save preferences</Button>
      </form>
    </Card>
  );
}

export function ProfileForm({ name }: { name: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name, currentPassword: "", newPassword: "" });
  const { busy, error, saved, run } = useSubmit();
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Profile and password</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("/api/me", {
              method: "PATCH",
              body: { name: form.name, ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}) },
            });
            setForm({ ...form, currentPassword: "", newPassword: "" });
            router.refresh();
          }, "Profile saved.");
        }}
      >
        <div>
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="p-cur">Current password</Label>
            <Input id="p-cur" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="p-new">New password</Label>
            <Input id="p-new" type="password" autoComplete="new-password" minLength={10} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </div>
        </div>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        {saved ? <p className="text-sm text-good" role="status">{saved}</p> : null}
        <Button type="submit" loading={busy}>Save profile</Button>
      </form>
    </Card>
  );
}

export function DeleteAccount({ logout }: { logout: () => Promise<void> }) {
  const [password, setPassword] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <Card className="border-bad/40 p-6">
      <h2 className="font-semibold">Delete account</h2>
      <p className="mt-1 text-sm text-muted">Permanently deletes your account, progress, quizzes, interviews and custom cards. This cannot be undone.</p>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!window.confirm("Delete your account and all study history permanently?")) return;
          void run(async () => {
            await api("/api/me", { method: "DELETE", body: { password } });
            await logout();
          }, "Deleted.");
        }}
      >
        <div className="min-w-56 flex-1">
          <Label htmlFor="d-pw">Confirm with your password</Label>
          <Input id="d-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" variant="danger" loading={busy}>Delete my account</Button>
      </form>
      {error ? <div className="mt-3"><ErrorNote>{error}</ErrorNote></div> : null}
    </Card>
  );
}
