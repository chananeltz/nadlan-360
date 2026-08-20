export interface Transaction {
  id: string;
  project: string;
  date: string; // YYYY-MM-DD
  saleYear: number;
  buildYear: number;
  rooms: number;
  floor: number;
  price: number;
  sqm: number;
  type: string; // e.g., 'commercial', 'residential'
}

export interface ProcessedTransaction extends Transaction {
  saleType: string;
  isMechirLamishtaken: boolean;
  isOutlier: boolean;
  normalizedPricePerSqm: number;
  pricePerSqm: number;
}

export function processRealEstateData(transactions: Transaction[]): {
  firstHand: ProcessedTransaction[];
  secondHand: ProcessedTransaction[];
  mechirLamishtaken: ProcessedTransaction[];
  outliers: ProcessedTransaction[];
  comparisonTable: any[];
} {
  const now = new Date();
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(now.getFullYear() - 2);

  // 1. Initial Filtering
  const filtered = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    const isWithin24Months = txDate >= twoYearsAgo;
    const isNotCommercial = tx.type !== 'commercial' && tx.type !== 'מסחרי';
    return isWithin24Months && isNotCommercial;
  });

  // 2. Classification (First Hand vs Second Hand)
  const classified: ProcessedTransaction[] = filtered.map(tx => {
    const diff = tx.saleYear - tx.buildYear;
    const saleType = diff >= 3 ? "יד שנייה" : "חדש מקבלן";
    return {
      ...tx,
      saleType,
      isMechirLamishtaken: false,
      isOutlier: false,
      pricePerSqm: tx.price / tx.sqm,
      normalizedPricePerSqm: 0,
    };
  });

  // Group by project and rooms for Median calculation
  const groups = new Map<string, ProcessedTransaction[]>();
  classified.forEach(tx => {
    const key = `${tx.project}_${tx.rooms}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  });

  // 3. Identify Mechir Lamishtaken (Price < 85% of Median)
  groups.forEach((groupTxs, key) => {
    const prices = groupTxs.map(t => t.price).sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const median = prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
    
    groupTxs.forEach(tx => {
      if (tx.price < median * 0.85) {
        tx.isMechirLamishtaken = true;
      }
    });
  });

  // 4. Outlier Handling (> 30% deviation from group average)
  groups.forEach((groupTxs, key) => {
    const validTxs = groupTxs.filter(t => !t.isMechirLamishtaken);
    if (validTxs.length === 0) return;
    
    const avg = validTxs.reduce((sum, t) => sum + t.price, 0) / validTxs.length;
    
    validTxs.forEach(tx => {
      if (tx.price > avg * 1.3 || tx.price < avg * 0.7) {
        tx.isOutlier = true;
      }
    });
  });

  // 5. Normalization (Normalize price per sqm to floor 1)
  // Assuming 1% increase in value per floor above 1
  classified.forEach(tx => {
    const floorFactor = tx.floor > 1 ? 1 + ((tx.floor - 1) * 0.01) : 1;
    tx.normalizedPricePerSqm = tx.pricePerSqm / floorFactor;
  });

  // 6. Output Generation
  const firstHand = classified.filter(t => t.saleType === "חדש מקבלן" && !t.isMechirLamishtaken && !t.isOutlier);
  const secondHand = classified.filter(t => t.saleType === "יד שנייה" && !t.isMechirLamishtaken && !t.isOutlier);
  const mechirLamishtaken = classified.filter(t => t.isMechirLamishtaken);
  const outliers = classified.filter(t => t.isOutlier);

  // Generate Comparison Table
  const comparisonTable = Array.from(groups.entries()).map(([key, txs]) => {
    const validTxs = txs.filter(t => !t.isMechirLamishtaken && !t.isOutlier);
    const avgPrice = validTxs.length ? validTxs.reduce((s, t) => s + t.price, 0) / validTxs.length : 0;
    const avgNormalized = validTxs.length ? validTxs.reduce((s, t) => s + t.normalizedPricePerSqm, 0) / validTxs.length : 0;
    return {
      group: key,
      validTransactionsCount: validTxs.length,
      averagePrice: avgPrice,
      averageNormalizedPricePerSqm: avgNormalized
    };
  });

  return {
    firstHand,
    secondHand,
    mechirLamishtaken,
    outliers,
    comparisonTable
  };
}
