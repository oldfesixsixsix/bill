import { sql } from 'drizzle-orm'
import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core'

export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  initialBalance: integer('initial_balance').notNull().default(0),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})

// kind distinguishes the Income tree from the Expense tree (CONTEXT.md: Category).
// Two-level depth (parentId null = top level, parentId set = leaf) is enforced in
// application code, not here — SQLite has no clean way to check recursion depth.
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['income', 'expense'] }).notNull(),
  parentId: integer('parent_id').references((): any => categories.id),
  name: text('name').notNull(),
})

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
})

export const drinkPresets = sqliteTable('drink_presets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  caffeineMg: integer('caffeine_mg').notNull().default(0),
  sugarG: real('sugar_g').notNull().default(0),
})

// Transaction is the receipt-level record (ADR-0001). transferToAccountId is only
// set when type = 'transfer'; accountId is always the source/primary account.
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['income', 'expense', 'transfer'] }).notNull(),
  date: text('date').notNull(),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  transferToAccountId: integer('transfer_to_account_id').references(() => accounts.id),
  eventId: integer('event_id').references(() => events.id),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`(current_timestamp)`),
})

// TransactionItem is the line-level record (ADR-0001). categoryId is null for
// transfer items, since Transfer does not belong to any Category.
export const transactionItems = sqliteTable('transaction_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => categories.id),
  drinkPresetId: integer('drink_preset_id').references(() => drinkPresets.id),
  amount: integer('amount').notNull(),
  note: text('note'),
})
