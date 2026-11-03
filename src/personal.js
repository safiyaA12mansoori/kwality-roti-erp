import { between, round, sum } from './calc'

export const PERSONAL_CATS = [
  { id: 'emi', name: 'EMI', color: '#7c5cfc' },
  { id: 'petrol', name: 'Petrol', color: '#ea580c' },
  { id: 'ration', name: 'Rashan', color: '#16a34a' },
  { id: 'home', name: 'Home expenses', color: '#0284c7' },
  { id: 'education', name: 'Education', color: '#c026d3' },
  { id: 'other', name: 'Other', color: '#ca8a04' },
]

export function catName(id) {
  return PERSONAL_CATS.find((item) => item.id === id)?.name || 'Other'
}

export function catColor(id) {
  return PERSONAL_CATS.find((item) => item.id === id)?.color || '#ca8a04'
}

export function emptyPersonal() {
  return { incomes: [], expenses: [], nextBill: 1 }
}

export function personalSummary(personal, from, to) {
  const books = personal || emptyPersonal()
  const expenses = (books.expenses || []).filter((row) => between(row.date, from, to))
  const incomes = (books.incomes || []).filter((row) => between(row.date, from, to))
  const byCat = Object.fromEntries(PERSONAL_CATS.map((item) => [item.id, 0]))
  for (const row of expenses) {
    const key = byCat[row.category] == null ? 'other' : row.category
    byCat[key] = round(byCat[key] + (Number(row.amount) || 0))
  }
  const spent = sum(expenses, (row) => row.amount)
  const income = sum(incomes, (row) => row.amount)
  const allSpent = sum(books.expenses || [], (row) => row.amount)
  const allIncome = sum(books.incomes || [], (row) => row.amount)
  return {
    expenses: expenses.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.no).localeCompare(String(a.no))),
    incomes: incomes.slice().sort((a, b) => b.date.localeCompare(a.date) || String(b.no).localeCompare(String(a.no))),
    byCat,
    spent,
    income,
    left: round(income - spent),
    available: round(allIncome - allSpent),
    allSpent,
    allIncome,
  }
}
