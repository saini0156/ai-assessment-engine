import { Users } from "lucide-react";

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <h1 className="text-3xl font-extrabold tracking-tight text-neutral-900">Users</h1>
      <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600">
          <Users className="h-6 w-6" />
        </span>
        <p className="mt-4 text-base font-bold text-neutral-900">User management is coming soon</p>
        <p className="mt-1 max-w-sm text-sm text-neutral-500">
          This page will list all registered users once the backend provides the data.
        </p>
      </div>
    </div>
  );
}