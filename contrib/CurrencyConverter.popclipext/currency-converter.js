// 貨幣符號、名稱與代碼的對應
const CURRENCY_MAP = {
  // 符號
  '$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '¥': 'JPY',
  '￥': 'JPY',
  '円': 'JPY',
  '元': 'CNY',
  '日圓': 'JPY',
  '台幣': 'TWD',
  '美金': 'USD',
  '美元': 'USD',
  '歐元': 'EUR',
  '英鎊': 'GBP',
  '港幣': 'HKD',
  '人民幣': 'CNY',
  '韓元': 'KRW',
  '泰銖': 'THB',
  '₹': 'INR',
  '₽': 'RUB',
  '฿': 'THB',
  '₱': 'PHP',
  '₩': 'KRW',
  '₪': 'ILS',
  '₨': 'PKR',
  '₦': 'NGN',
  '₴': 'UAH',
  '₡': 'CRC',
  '₵': 'GHS',
  '¢': 'USD',
  // 常見縮寫與名稱
  'AED': 'AED',
  'DH': 'AED',
  'DIRHAM': 'AED',
  'DHIRAM': 'AED',
  'TWD': 'TWD',
  'HKD': 'HKD',
  'CNY': 'CNY',
  'JPY': 'JPY',
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'AUD': 'AUD',
  'CAD': 'CAD',
  'SGD': 'SGD',
  'S$': 'SGD',
  'NT$': 'TWD',
  'HK$': 'HKD',
  'AU$': 'AUD'
};

// 解析文字中的貨幣和金額
function parseCurrency(text) {
  const cleanText = text.trim().toUpperCase();

  // 1. 尋找金額
  // 匹配包含數字、逗號和句點的字串 (例如: 62,700.00 或 62.700,00)
  const numberMatch = cleanText.match(/[\d,.]+/);
  if (!numberMatch) {
    throw new Error('無法解析金額');
  }

  let amountStr = numberMatch[0];
  const amountIndex = cleanText.indexOf(amountStr);

  // 解析金額格式 (處理 1,234.56 或 1.234,56)
  if (amountStr.includes(',') && amountStr.includes('.')) {
    if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
      // 點是千分位，逗號是小數點 (1.234,56)
      amountStr = amountStr.replace(/\./g, '').replace(',', '.');
    } else {
      // 逗號是千分位，點是小數點 (1,234.56)
      amountStr = amountStr.replace(/,/g, '');
    }
  } else if (amountStr.includes(',')) {
    // 只有逗號：判斷是千分位還是小數點
    const parts = amountStr.split(',');
    if (parts.length > 2 || parts[parts.length - 1].length !== 2) {
      // 多於一個逗號或是後面不是兩位數，視為千分位
      amountStr = amountStr.replace(/,/g, '');
    } else {
      // 視為小數點 (例如 10,50)
      amountStr = amountStr.replace(',', '.');
    }
  }

  const amount = parseFloat(amountStr);
  if (isNaN(amount)) {
    throw new Error('金額格式無效');
  }

  // 2. 尋找幣種
  let currency = null;

  // 優先尋找 3 位英文字母的 ISO 代碼
  const isoMatch = cleanText.match(/(?:^|[^A-Z])([A-Z]{3})(?=$|[^A-Z])/i);
  if (isoMatch && CURRENCY_MAP[isoMatch[1].toUpperCase()]) {
    currency = isoMatch[1].toUpperCase();
  } else if (isoMatch) {
    // 如果是 3 位大寫且不在 map 中，也嘗試使用它 (提高靈活性)
    currency = isoMatch[1].toUpperCase();
  }

  // 如果沒找到，檢查地圖中的其他鍵 (符號或中文)
  if (!currency) {
    // 遍歷所有可能的標識符，按長度排序以防短標識符誤鎖長標識符 (如 $ 誤鎖 NT$)
    const sortedKeys = Object.keys(CURRENCY_MAP).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      if (cleanText.includes(key)) {
        currency = CURRENCY_MAP[key];
        break;
      }
    }
  }

  // 預設為 USD (如果文字中包含了某些數字但感覺像金額)
  if (!currency) {
    currency = 'USD';
  }

  return { currency, amount };
}

// 格式化貨幣顯示
function formatCurrency(amount, currency) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

// 獲取匯率
async function getExchangeRate(fromCurrency, toCurrency, apiKey) {
  const baseUrl = apiKey
    ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`
    : `https://open.er-api.com/v6/latest/${fromCurrency}`;

  const axios = require('axios');
  const response = await axios.get(baseUrl);

  if (response.data.result === 'error') {
    throw new Error(response.data['error-type'] || 'API 錯誤');
  }

  const rates = response.data.rates;

  if (!rates[toCurrency]) {
    throw new Error(`不支援的幣種: ${toCurrency}`);
  }

  return rates[toCurrency];
}

// 主要動作 - 完全比照 snippet 的格式
exports.actions = [{
  code: async (input, options) => {
    try {
      const text = input.text;
      // 從下拉選單的值中提取貨幣代碼（移除國旗emoji）
      const targetCurrency = options.targetCurrency.split(' ').pop().toUpperCase();

      const { currency: fromCurrency, amount } = parseCurrency(text);

      if (fromCurrency === targetCurrency) {
        popclip.showText(`Already in ${targetCurrency}: ${formatCurrency(amount, targetCurrency)}`);
        return;
      }

      const rate = await getExchangeRate(fromCurrency, targetCurrency, options.apiKey);
      const convertedAmount = amount * rate;

      const result = `${formatCurrency(amount, fromCurrency)} = ${formatCurrency(convertedAmount, targetCurrency)}`;
      popclip.showText(result, { preview: true });

    } catch (error) {
      popclip.showText(`錯誤: ${error.message}`);
    }
  }
}];