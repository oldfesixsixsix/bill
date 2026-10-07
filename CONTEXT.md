# 記帳工具 (Expense Tracker)

個人記帳工具,追蹤帳戶餘額、分類開銷,並提供旅程/事件彙總、每日結算收據、飲品攝取量計算等附加功能。單人使用,以 Cloudflare Access 的登入身份作為唯一使用者範圍,不設多人共用帳本。

## Language

**Account(帳戶)**:
資金所在的地方,例如現金、銀行帳戶、信用卡。每個 Account 有一個依交易累計算出的餘額。
_Avoid_: Wallet, Ledger

**Transaction(交易)**:
一張收據層級的記錄,類型為 Income、Expense 或 Transfer 之一,持有 Account(付款帳戶,Income/Expense 為一個,Transfer 為來源+目的兩個)與可選的 Event 標籤。底下包含一個或多個 TransactionItem。
_Avoid_: Entry, Record, Bill

**TransactionItem(交易明細)**:
Transaction 底下的一筆明細,持有金額、Category、備註,以及可選的 Drink preset(用於飲控計算)。一張 Transaction 的所有 TransactionItem 金額加總即為該筆交易總額。
_Avoid_: Line item(英文討論可用,但資料表/中文文件統一用「明細」)

**Transfer(轉帳)**:
一種 Transaction 類型,代表金錢在兩個 Account 之間移動,不計入收入或支出統計。
_Avoid_: Move, Internal transaction

**Category(類別)**:
用於分類 Income 或 Expense 交易的樹狀結構,最多兩層(父類別、子類別)。Income 與 Expense 各自擁有獨立的 Category 樹,互不共用,Transfer 不屬於任何 Category。
_Avoid_: Tag(保留給 Event 使用)

**DailyReceipt(每日收據)**:
使用者手動選擇任一天,系統將該天所有 Transaction/TransactionItem 彙總成模仿統一發票版面的視覺呈現(發票號碼為裝飾性亂數),純裝飾用途,不涉及真實發票號碼、對獎邏輯或法律效力。按需產生,不走排程。
_Avoid_: Invoice(容易讓人誤會是真實發票)

**DrinkPreset(飲品預設)**:
使用者自建的可重用飲品項目,記錄名稱與對應的咖啡因(mg)、糖分(g)含量。TransactionItem 可選擇關聯一個 DrinkPreset 以帶入含量數值。
_Avoid_: Drink(範圍太廣,此處特指「預設範本」而非每次消費記錄)

**Event(事件)**:
一個輕量標籤實體(名稱 + 可選日期區間),例如一趟旅程、一場婚禮、一個專案。Transaction 可選擇性地關聯一個 Event,用於跨 Category 統計該事件的總花費,但不影響 Transaction 本身的 Category 分類。
_Avoid_: Trip(僅作為 Event 的一種使用情境,不是獨立概念)
