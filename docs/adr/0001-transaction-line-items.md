# Transaction 支援多個 line item

**Status**: accepted

Transaction 的最小單位該是「一筆金額+一個類別」還是「一張收據底下可拆多個明細」,兩者皆是成熟記帳工具常見做法,曾考慮過較簡單的單一類別模型。選擇後者(Transaction 作為收據層容器,底下有多個 TransactionItem),原因是飲控功能(咖啡因/糖分)需要在同一張收據裡混記飲品與其他商品、各自歸類,且使用者明確希望貼近真實收據結構。代價是資料模型、輸入 UI、分類統計都要跨 Transaction/TransactionItem 兩層處理,日後若要改回單層模型需要資料搬移。
