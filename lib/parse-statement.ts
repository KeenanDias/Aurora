// Import the actual parser directly — pdf-parse's index.js has a bug where it
// tries to open a test PDF file on require(), so we bypass it
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require("pdf-parse/lib/pdf-parse")
import OpenAI from "openai"

export type ParsedTransaction = {
  date: string // ISO date
  description: string
  amount: number // positive = debit/spending, negative = credit/deposit
  category: string
}

export type StatementIdentity = {
  institutionName: string | null
  accountMask: string | null       // last 4 digits
  accountHolderName: string | null
  transitNumber: string | null     // Canadian 5-digit branch
  institutionNumber: string | null // Canadian 3-digit institution code
}

export type ParsedStatement = {
  periodStart: string // ISO date
  periodEnd: string // ISO date
  totalIncome: number
  totalSpending: number
  fixedBills: number
  closingBalance: number | null
  identity: StatementIdentity
  transactions: ParsedTransaction[]
}

// Keywords for categorization
const CATEGORY_RULES: { pattern: RegExp; category: string; isFixed: boolean }[] = [
  { pattern: /rent|mortgage|landlord/i, category: "RENT_AND_UTILITIES", isFixed: true },
  { pattern: /electric|gas\s*co|water|sewer|utility|utilities/i, category: "RENT_AND_UTILITIES", isFixed: true },
  { pattern: /insurance|geico|allstate|progressive|state\s*farm/i, category: "INSURANCE", isFixed: true },
  { pattern: /comcast|xfinity|verizon|t-mobile|at&t|sprint|internet|phone/i, category: "RENT_AND_UTILITIES", isFixed: true },
  { pattern: /netflix|spotify|hulu|disney|apple\s*(tv|music)|youtube|subscription/i, category: "ENTERTAINMENT", isFixed: false },
  { pattern: /grocery|kroger|walmart|target|whole\s*foods|trader|safeway|aldi/i, category: "FOOD_AND_DRINK", isFixed: false },
  { pattern: /starbucks|coffee|cafe|dunkin/i, category: "FOOD_AND_DRINK", isFixed: false },
  { pattern: /restaurant|doordash|uber\s*eats|grubhub|mcdonald|chipotle/i, category: "FOOD_AND_DRINK", isFixed: false },
  { pattern: /uber|lyft|gas\s*station|shell|chevron|exxon|bp|parking|transit/i, category: "TRANSPORTATION", isFixed: false },
  { pattern: /amazon|ebay|shopify|online\s*purchase/i, category: "SHOPPING", isFixed: false },
  { pattern: /gym|fitness|planet|equinox/i, category: "RECREATION", isFixed: false },
  { pattern: /payroll|direct\s*dep|salary|wage|venmo|zelle|paypal|cash\s*app/i, category: "INCOME", isFixed: false },
  { pattern: /online\s*banking\s*transfer/i, category: "INTERNAL_TRANSFER", isFixed: false },
  { pattern: /e-transfer\s*sent|etransfer\s*sent|interac.*sent/i, category: "TRANSFER_OUT", isFixed: false },
  { pattern: /e-transfer\s*(?:received|rec|auto)/i, category: "INCOME", isFixed: false },
  { pattern: /transfer|xfer/i, category: "TRANSFER", isFixed: false },
  { pattern: /loan|student|car\s*pay/i, category: "LOAN_PAYMENTS", isFixed: true },
  { pattern: /fit4less|goodlife|planet\s*fitness|gym/i, category: "RECREATION", isFixed: true },
  { pattern: /noodle|sushi|pizza|burger|restaurant|food/i, category: "FOOD_AND_DRINK", isFixed: false },
  { pattern: /e-transfer|etransfer|interac/i, category: "TRANSFER", isFixed: false },
]

function categorize(description: string): { category: string; isFixed: boolean } {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(description)) {
      return { category: rule.category, isFixed: rule.isFixed }
    }
  }
  return { category: "OTHER", isFixed: false }
}

/**
 * Use OpenAI to parse bank statement text that regex can't handle.
 * This handles columnar PDFs, Canadian banks, unusual formats, etc.
 */
async function aiParseTransactions(rawText: string): Promise<{
  transactions: ParsedTransaction[]
  periodStart: string
  periodEnd: string
  closingBalance: number | null
  identity: StatementIdentity
}> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are a bank statement parser. Extract ALL transactions from the raw text of a bank statement PDF.

CRITICAL: Bank statement PDFs often have columnar tables. When extracted as text, the columns (Date, Description, Withdrawals, Deposits, Balance) get jumbled. You MUST carefully reconstruct the table by matching each transaction row across columns.

## How bank statement tables work
Each row has: Date | Description | Withdrawal amount OR Deposit amount | Running Balance
- The Withdrawals column = money OUT (spending, payments, e-transfers sent)
- The Deposits column = money IN (income, transfers received)
- The Balance column = running account balance AFTER the transaction (DO NOT use this as the transaction amount)
- Numbers like "6254", "7206", "7414", "8724" appearing in descriptions are reference numbers, NOT amounts

## Amount matching rules
- Use ONLY the Withdrawal($) or Deposit($) column values as transaction amounts
- The Balance column shows the running total — NEVER use it as the transaction amount
- Reference numbers in descriptions (e.g., "transfer - 7206") are NOT amounts
- Common withdrawal amounts: 9.03 (recurring bill), 44.00, 15.00, 11.39, 244.66
- Common deposit amounts: 300.00, 400.00
- If a transaction has a withdrawal, it has NO deposit, and vice versa

## Date format rules
- "9Mar" or "9 Mar" = March 9. "13Mar" = March 13. "1Apr" or "1 Apr" = April 1.
- Infer the year from statement context. Default to current year.

## What to skip
- "Opening Balance" and "Closing Balance" are NOT transactions
- Summary lines like "Total deposits" are NOT individual transactions

## Identity extraction
Also extract these fields from the statement header/footer:
- institutionName: The bank name (e.g., "TD Canada Trust", "RBC Royal Bank", "Scotiabank", "BMO", "Chase")
- accountMask: The last 4 digits of the account number (look for patterns like "Account: ****1234", "Acct #...1234", or extract last 4 from a full account number)
- accountHolderName: The account holder's name (look near "Statement for:", "Account holder:", or the name/address block at the top)
- transitNumber: Canadian 5-digit branch/transit number (if present)
- institutionNumber: Canadian 3-digit institution code (if present, e.g., "004" for TD, "003" for RBC)

Return JSON:
{
  "periodStart": "YYYY-MM-DD",
  "periodEnd": "YYYY-MM-DD",
  "closingBalance": 0.00,
  "institutionName": "...",
  "accountMask": "1234",
  "accountHolderName": "...",
  "transitNumber": "12345",
  "institutionNumber": "004",
  "transactions": [
    {"date": "YYYY-MM-DD", "description": "...", "amount": 0.00, "type": "withdrawal" or "deposit"}
  ]
}

Extract the "Closing Balance" value from the statement as closingBalance. This is the final account balance shown at the end of the statement. Set any identity field to null if not found.`,
      },
      {
        role: "user",
        content: `Parse this bank statement text:\n\n${rawText.slice(0, 8000)}`,
      },
    ],
  })

  const content = response.choices[0].message.content
  const emptyIdentity: StatementIdentity = { institutionName: null, accountMask: null, accountHolderName: null, transitNumber: null, institutionNumber: null }
  if (!content) return { transactions: [], periodStart: "", periodEnd: "", closingBalance: null, identity: emptyIdentity }

  const parsed = JSON.parse(content)

  const transactions: ParsedTransaction[] = (parsed.transactions ?? []).map(
    (tx: { date: string; description: string; amount: number; type: string }) => {
      const { category } = categorize(tx.description)
      // Positive = spending (withdrawal), negative = income (deposit)
      const amount = tx.type === "deposit" ? -Math.abs(tx.amount) : Math.abs(tx.amount)
      return {
        date: tx.date,
        description: tx.description,
        amount,
        category,
      }
    }
  )

  return {
    transactions,
    periodStart: parsed.periodStart ?? "",
    periodEnd: parsed.periodEnd ?? "",
    closingBalance: typeof parsed.closingBalance === "number" ? parsed.closingBalance : null,
    identity: {
      institutionName: parsed.institutionName ?? null,
      accountMask: parsed.accountMask ?? null,
      accountHolderName: parsed.accountHolderName ?? null,
      transitNumber: parsed.transitNumber ?? null,
      institutionNumber: parsed.institutionNumber ?? null,
    },
  }
}

/**
 * Parse a bank statement PDF buffer into structured transaction data.
 * Uses regex first, falls back to AI parsing for complex/columnar formats.
 */
export async function parseStatement(pdfBuffer: Buffer): Promise<ParsedStatement> {
  const result = await pdf(pdfBuffer)
  const text: string = result.text

  // ── Try regex parsing first (fast path for simple formats) ──────────
  const TX_PATTERNS = [
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
    /(\d{4}-\d{2}-\d{2})\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
    /(\d{1,2}-\d{1,2}(?:-\d{2,4})?)\s+(.+?)\s+(-?\$?[\d,]+\.\d{2})\s*$/,
  ]

  const lines = text.split("\n").map((l: string) => l.trim()).filter(Boolean)
  const regexTransactions: ParsedTransaction[] = []

  for (const line of lines) {
    for (const pattern of TX_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        const amount = parseFloat(match[3].replace(/[$,]/g, ""))
        const { category } = categorize(match[2].trim())
        regexTransactions.push({
          date: match[1],
          description: match[2].trim(),
          amount,
          category,
        })
        break
      }
    }
  }

  // ── If regex found transactions, use them ──────────────────────────
  if (regexTransactions.length > 0) {
    return buildResult(regexTransactions, text)
  }

  // ── Regex found nothing — fall back to AI parsing ──────────────────
  console.log("Regex found 0 transactions, using AI parser...")
  const aiResult = await aiParseTransactions(text)

  if (aiResult.transactions.length > 0) {
    return buildResultFromAI(aiResult)
  }

  // ── Neither worked — return empty with period from text ────────────
  const now = new Date()
  return {
    periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0],
    periodEnd: now.toISOString().split("T")[0],
    totalIncome: 0,
    totalSpending: 0,
    fixedBills: 0,
    closingBalance: null,
    identity: { institutionName: null, accountMask: null, accountHolderName: null, transitNumber: null, institutionNumber: null },
    transactions: [],
  }
}

function buildResult(transactions: ParsedTransaction[], text: string): ParsedStatement {
  let periodStart = ""
  let periodEnd = ""

  const periodMatch = text.match(
    /(?:statement\s*period|period|from)\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:to|-|through)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i
  )
  if (periodMatch) {
    periodStart = periodMatch[1]
    periodEnd = periodMatch[2]
  } else if (transactions.length > 0) {
    const dates = transactions.map((t) => t.date).sort()
    periodStart = dates[0]
    periodEnd = dates[dates.length - 1]
  }

  if (!periodStart) {
    const now = new Date()
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    periodEnd = now.toISOString().split("T")[0]
  }

  // Extract closing balance from text
  const closingMatch = text.match(/closing\s*balance\s*\$?([\d,]+\.\d{2})/i)
  const closingBalance = closingMatch ? parseFloat(closingMatch[1].replace(/,/g, "")) : null

  // Extract identity from text via regex
  const identity = extractIdentityFromText(text)

  return computeSummaries({ periodStart, periodEnd, transactions, closingBalance, identity })
}

function buildResultFromAI(aiResult: {
  transactions: ParsedTransaction[]
  periodStart: string
  periodEnd: string
  closingBalance: number | null
  identity: StatementIdentity
}): ParsedStatement {
  let { periodStart, periodEnd } = aiResult
  if (!periodStart && aiResult.transactions.length > 0) {
    const dates = aiResult.transactions.map((t) => t.date).sort()
    periodStart = dates[0]
    periodEnd = dates[dates.length - 1]
  }
  if (!periodStart) {
    const now = new Date()
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]
    periodEnd = now.toISOString().split("T")[0]
  }
  return computeSummaries({ periodStart, periodEnd, transactions: aiResult.transactions, closingBalance: aiResult.closingBalance, identity: aiResult.identity })
}

// Canadian bank name patterns for regex-based identity extraction
const BANK_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /TD\s*Canada\s*Trust|Toronto[- ]Dominion/i, name: "TD Canada Trust" },
  { pattern: /RBC\s*Royal\s*Bank|Royal\s*Bank\s*of\s*Canada/i, name: "RBC Royal Bank" },
  { pattern: /Scotiabank|Bank\s*of\s*Nova\s*Scotia/i, name: "Scotiabank" },
  { pattern: /BMO|Bank\s*of\s*Montreal/i, name: "BMO" },
  { pattern: /CIBC|Canadian\s*Imperial/i, name: "CIBC" },
  { pattern: /National\s*Bank\s*of\s*Canada|Banque\s*Nationale/i, name: "National Bank" },
  { pattern: /Tangerine/i, name: "Tangerine" },
  { pattern: /Simplii\s*Financial/i, name: "Simplii Financial" },
  { pattern: /Desjardins/i, name: "Desjardins" },
  { pattern: /ATB\s*Financial/i, name: "ATB Financial" },
  { pattern: /HSBC\s*Canada|HSBC\s*Bank/i, name: "HSBC Canada" },
  { pattern: /Chase|JPMorgan/i, name: "Chase" },
  { pattern: /Bank\s*of\s*America/i, name: "Bank of America" },
  { pattern: /Wells\s*Fargo/i, name: "Wells Fargo" },
  { pattern: /Capital\s*One/i, name: "Capital One" },
]

function extractIdentityFromText(text: string): StatementIdentity {
  // Institution name
  let institutionName: string | null = null
  for (const bp of BANK_PATTERNS) {
    if (bp.pattern.test(text)) {
      institutionName = bp.name
      break
    }
  }

  // Account mask — last 4 digits from account number patterns
  let accountMask: string | null = null
  const maskPatterns = [
    /account\s*(?:#|number|no\.?)\s*:?\s*[\w*Xx.-]*(\d{4})\b/i,
    /acct\s*(?:#|no\.?)\s*:?\s*[\w*Xx.-]*(\d{4})\b/i,
    /\*{2,}(\d{4})/,
    /x{2,}(\d{4})/i,
  ]
  for (const mp of maskPatterns) {
    const m = text.match(mp)
    if (m) { accountMask = m[1]; break }
  }

  // Account holder name — look near common labels
  let accountHolderName: string | null = null
  const nameMatch = text.match(/(?:statement\s*for|account\s*holder|account\s*name|prepared\s*for)\s*:?\s*([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){1,3})/i)
  if (nameMatch) accountHolderName = nameMatch[1].trim()

  // Canadian transit number (5 digits)
  let transitNumber: string | null = null
  const transitMatch = text.match(/(?:transit|branch)\s*(?:#|number|no\.?)?\s*:?\s*(\d{5})\b/i)
  if (transitMatch) transitNumber = transitMatch[1]

  // Canadian institution number (3 digits)
  let institutionNumber: string | null = null
  const instMatch = text.match(/(?:institution|inst)\s*(?:#|number|no\.?)?\s*:?\s*(\d{3})\b/i)
  if (instMatch) institutionNumber = instMatch[1]

  return { institutionName, accountMask, accountHolderName, transitNumber, institutionNumber }
}

function computeSummaries(data: {
  periodStart: string
  periodEnd: string
  transactions: ParsedTransaction[]
  closingBalance: number | null
  identity: StatementIdentity
}): ParsedStatement {
  let totalIncome = 0
  let totalSpending = 0
  let fixedBills = 0

  for (const tx of data.transactions) {
    if (tx.amount < 0 || tx.category === "INCOME") {
      // Money coming IN — count as income (including internal transfers into this account)
      totalIncome += Math.abs(tx.amount)
    } else if (tx.amount > 0 && tx.category !== "INTERNAL_TRANSFER") {
      // Money going OUT — count as spending, but skip internal transfers between own accounts
      totalSpending += tx.amount
      const { isFixed } = categorize(tx.description)
      if (isFixed) fixedBills += tx.amount
    }
    // INTERNAL_TRANSFER outflows (positive amount) are skipped — just moving money between your own accounts
  }

  return {
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalSpending: Math.round(totalSpending * 100) / 100,
    fixedBills: Math.round(fixedBills * 100) / 100,
    closingBalance: data.closingBalance,
    identity: data.identity,
    transactions: data.transactions,
  }
}
