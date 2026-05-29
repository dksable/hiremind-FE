import { FormEvent, useState } from "react";
import { useAuth, Role, ManagedUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, UserPlus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  hr: "HR Manager",
  viewer: "Viewer",
};

const ROLE_VARIANTS: Record<Role, "default" | "secondary" | "outline"> = {
  admin: "default",
  hr: "secondary",
  viewer: "outline",
};

export default function UsersPage() {
  const { users, addUser, updateUser, deleteUser, user } = useAuth();
  const [form, setForm] = useState<ManagedUser>({ email: "", name: "", password: "", role: "viewer" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.email || !form.name || !form.password) {
      return toast.error("All fields are required");
    }
    const res = await addUser(form);
    if (!res.ok) return toast.error(res.error || "Failed to add user");
    toast.success(`Added ${form.name}`);
    setForm({ email: "", name: "", password: "", role: "viewer" });
  }

  async function onDelete(email: string) {
    const res = await deleteUser(email);
    if (!res.ok) return toast.error(res.error || "Failed to delete");
    toast.success("User removed");
  }

  return (
    <main className="container py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">Add team members and manage their access roles.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="h-4 w-4" /> Add new user
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-1.5 md:col-span-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v: Role) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="hr">HR Manager</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5">
              <Button type="submit"><UserPlus className="h-4 w-4 mr-1" /> Add user</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Team members ({users.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => {
                const isSelf = user?.email.toLowerCase() === u.email.toLowerCase();
                return (
                  <TableRow key={u.email}>
                    <TableCell className="font-medium">
                      {u.name} {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={async (v: Role) => {
                        const res = await updateUser(u.email, { role: v });
                        if (!res.ok) toast.error(res.error || "Failed to update role");
                      }}>
                        <SelectTrigger className="w-36">
                          <SelectValue>
                            <Badge variant={ROLE_VARIANTS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="hr">HR Manager</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(u.email)}
                        disabled={isSelf}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
