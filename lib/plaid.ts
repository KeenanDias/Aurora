import { Configuration, CountryCode, PlaidApi, PlaidEnvironments } from "plaid"

const plaidEnv = process.env.PLAID_ENV || "sandbox"

const configuration = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
      "PLAID-SECRET": process.env.PLAID_SECRET!,
    },
  },
})

export const plaidClient = new PlaidApi(configuration)

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
