import { Configuration, CountryCode, PlaidApi, PlaidEnvironments } from "plaid"

// Lazy-init so the client is constructed at request time, not at module
// load. Next.js's build-time page-data collection evaluates module
// top-level code without env vars injected — `new PlaidApi(...)` would
// otherwise crash the build with "Missing credentials."
//
// PLAID_ENV maps to the Plaid SDK's pre-baked URL list:
//   sandbox     → https://sandbox.plaid.com
//   development → https://development.plaid.com
//   production  → https://production.plaid.com
// Any other value falls back to sandbox + warns once.
let _plaidClient: PlaidApi | null = null
let _envWarned = false
function getPlaidClient(): PlaidApi {
  if (_plaidClient) return _plaidClient
  const rawEnv = (process.env.PLAID_ENV || "sandbox").toLowerCase()
  const validEnvs = new Set(Object.keys(PlaidEnvironments))
  let plaidEnv = rawEnv
  if (!validEnvs.has(rawEnv)) {
    if (!_envWarned) {
      console.warn(
        `[plaid] Unknown PLAID_ENV "${rawEnv}". Valid options: ${Array.from(validEnvs).join(", ")}. Falling back to sandbox.`
      )
      _envWarned = true
    }
    plaidEnv = "sandbox"
  }
  if (plaidEnv === "production") {
    // Production deserves a startup signal so it's clear which environment is hot.
    console.log("[plaid] Initialized against PRODUCTION endpoint")
  }
  const configuration = new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
      },
    },
  })
  _plaidClient = new PlaidApi(configuration)
  return _plaidClient
}

// Proxy keeps the `import { plaidClient } from "@/lib/plaid"` call sites
// unchanged. Any property access constructs the underlying client on demand.
export const plaidClient = new Proxy({} as PlaidApi, {
  get(_target, prop) {
    const client = getPlaidClient() as unknown as Record<string | symbol, unknown>
    const value = client[prop]
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value
  },
}) as PlaidApi

export type PlaidIdentityData = {
  institutionId: string
  institutionName: string
  accounts: {
    accountId: string
    name: string
    mask: string
    type: string
    eftInstitution?: string | null
    eftBranch?: string | null
  }[]
}

/**
 * Fetch institution info and account identity data at link time.
 * Uses /item/get, /institutions/get_by_id, and /auth/get.
 */
export async function fetchPlaidIdentity(accessToken: string): Promise<PlaidIdentityData> {
  // Get item to find institution_id
  const itemRes = await plaidClient.itemGet({ access_token: accessToken })
  const institutionId = itemRes.data.item.institution_id ?? ""

  // Get institution name
  let institutionName = ""
  if (institutionId) {
    try {
      const instRes = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us, CountryCode.Ca],
      })
      institutionName = instRes.data.institution.name
    } catch {
      // Non-critical — we can still match on other fields
    }
  }

  // Get account masks and Canadian EFT numbers via /auth/get
  let accounts: PlaidIdentityData["accounts"] = []
  try {
    const authRes = await plaidClient.authGet({ access_token: accessToken })
    const eftNumbers = authRes.data.numbers.eft ?? []

    accounts = authRes.data.accounts.map((a) => {
      const eft = eftNumbers.find((e) => e.account_id === a.account_id)
      return {
        accountId: a.account_id,
        name: a.name,
        mask: a.mask ?? "",
        type: a.type,
        eftInstitution: eft?.institution ?? null,
        eftBranch: eft?.branch ?? null,
      }
    })
  } catch {
    // Auth might not be available — fall back to basic accounts
    const acctRes = await plaidClient.accountsGet({ access_token: accessToken })
    accounts = acctRes.data.accounts.map((a) => ({
      accountId: a.account_id,
      name: a.name,
      mask: a.mask ?? "",
      type: a.type,
    }))
  }

  return { institutionId, institutionName, accounts }
}
