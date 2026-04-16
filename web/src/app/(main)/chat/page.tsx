"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy /chat URLs redirect to /dashboard (single chat home). */
function ChatRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const q = searchParams.toString();
    router.replace(q ? `/dashboard?${q}` : "/dashboard");
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-[#080a0f] text-sm text-white/45">
      Redirecting…
    </div>
  );
}

export default function ChatRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-1 items-center justify-center bg-[#080a0f] text-sm text-white/45">
          Loading…
        </div>
      }
    >
      <ChatRedirectInner />
    </Suspense>
  );
}
