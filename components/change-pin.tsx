"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { call } from "@/lib/client";

export function ChangePin() {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setOk(false);
      return setMessage("New PINs don't match");
    }
    const r = await call("POST", "/api/teacher/pin", { oldPin, newPin });
    setOk(r.ok);
    setMessage(r.ok ? "PIN changed" : r.data.error);
    if (r.ok) {
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change PIN</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-4">
          <div className="field">
            <Label htmlFor="old-pin">Old PIN</Label>
            <Input id="old-pin" type="password" inputMode="numeric" className="h-9" value={oldPin} onChange={(e) => setOldPin(e.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="new-pin">New PIN</Label>
            <Input id="new-pin" type="password" inputMode="numeric" className="h-9" value={newPin} onChange={(e) => setNewPin(e.target.value)} />
          </div>
          <div className="field">
            <Label htmlFor="confirm-pin">Confirm new PIN</Label>
            <Input id="confirm-pin" type="password" inputMode="numeric" className="h-9" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} />
          </div>
          {message && <p className={ok ? "text-sm text-success" : "error"}>{message}</p>}
          <Button type="submit" size="lg" disabled={!oldPin || !newPin || !confirmPin}>
            Change PIN
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
