import { resolvePrismaDatasourceUrls } from "./prisma-datasource";

describe("resolvePrismaDatasourceUrls", () => {
  const localUrl = "postgresql://local:test@127.0.0.1:5432/kiosq";
  const remotePoolUrl = "postgresql://pool:test@pool.example.test:6543/kiosq";
  const remoteDirectUrl = "postgresql://direct:test@db.example.test:5432/kiosq";

  it("uses both URLs loaded from dotenv when there is no process override", () => {
    expect(
      resolvePrismaDatasourceUrls(
        {},
        {
          databaseUrl: remotePoolUrl,
          directUrl: remoteDirectUrl,
        }
      )
    ).toEqual({
      directUrl: remoteDirectUrl,
      url: remotePoolUrl,
    });
  });

  it("pins both Prisma connections to an injected DATABASE_URL", () => {
    expect(
      resolvePrismaDatasourceUrls(
        { databaseUrl: localUrl },
        {
          databaseUrl: remotePoolUrl,
          directUrl: remoteDirectUrl,
        }
      )
    ).toEqual({
      directUrl: localUrl,
      url: localUrl,
    });
  });

  it("pins both Prisma connections to an injected DIRECT_URL", () => {
    expect(
      resolvePrismaDatasourceUrls(
        { directUrl: localUrl },
        {
          databaseUrl: remotePoolUrl,
          directUrl: remoteDirectUrl,
        }
      )
    ).toEqual({
      directUrl: localUrl,
      url: localUrl,
    });
  });

  it("keeps an explicitly injected URL pair", () => {
    expect(
      resolvePrismaDatasourceUrls(
        {
          databaseUrl: remotePoolUrl,
          directUrl: remoteDirectUrl,
        },
        { databaseUrl: localUrl, directUrl: localUrl }
      )
    ).toEqual({
      directUrl: remoteDirectUrl,
      url: remotePoolUrl,
    });
  });

  it("rejects missing database URLs", () => {
    expect(() => resolvePrismaDatasourceUrls({}, {})).toThrow(
      "DATABASE_URL is required by Prisma"
    );
  });

  it.each([
    [{ databaseUrl: "" }, { databaseUrl: remotePoolUrl }],
    [{ directUrl: "  " }, { databaseUrl: remotePoolUrl }],
    [{ databaseUrl: localUrl, directUrl: "" }, { databaseUrl: remotePoolUrl }],
  ])("rejects an explicitly blank process override", (injected, loaded) => {
    expect(() => resolvePrismaDatasourceUrls(injected, loaded)).toThrow(
      "Prisma database URL override cannot be blank"
    );
  });
});
