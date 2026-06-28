import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-svh overflow-hidden bg-slate-950 text-white lg:grid lg:grid-cols-[1.1fr_0.9fr]">
      <div className="relative hidden lg:block">
        <video
          autoPlay
          loop
          muted
          playsInline
          aria-label="Background video"
          className="h-full w-full object-cover"
        >
          <source src="/bgauth.webm" type="video/webm" />
        </video>
        <div className="absolute inset-0 bg-slate-950/25" />
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-950/95 p-10 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
