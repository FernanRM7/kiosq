import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-svh">
      <div className="hidden w-1/2 bg-muted lg:block">
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
      </div>
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
