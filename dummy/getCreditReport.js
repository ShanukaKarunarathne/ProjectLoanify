var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// functions/getCreditReport.js
var getCreditReport_exports = {};
__export(getCreditReport_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(getCreditReport_exports);
var import_node_fetch = __toESM(require("node-fetch"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var clientId = process.env.CLIENT_ID;
var clientSecret = process.env.CLIENT_SECRET;
var basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
async function getAccessToken() {
  const response = await (0, import_node_fetch.default)("https://api.sandbox.equifax.com/v2/oauth/token", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials&scope=https://api.equifax.com/business/oneview/consumer-credit/v1"
  });
  return response.json();
}
async function getCreditReport(accessToken, consumerDetails) {
  const response = await (0, import_node_fetch.default)("https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1/reports/credit-report", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "efx-client-correlation-id": "your-correlation-id-here"
    },
    body: JSON.stringify({
      "consumers": {
        "name": [{ "identifier": "current", "firstName": consumerDetails.firstName, "lastName": consumerDetails.lastName }],
        "socialNum": [{ "identifier": "current", "number": consumerDetails.socialSecurityNumber }],
        "addresses": [{
          "identifier": "current",
          "houseNumber": consumerDetails.houseNumber,
          "streetName": consumerDetails.streetName,
          "streetType": consumerDetails.streetType,
          "city": consumerDetails.city,
          "state": consumerDetails.state,
          "zip": consumerDetails.zip
        }],
        "birthDate": consumerDetails.birthDate
      },
      "customerReferenceidentifier": "2C800002-DOR7",
      "customerConfiguration": {
        "equifaxUSConsumerCreditReport": {
          "pdfComboIndicator": "Y",
          "memberNumber": "999XX12345",
          "securityCode": "@U2",
          "customerCode": "IAPI",
          "multipleReportIndicator": "1",
          "models": [
            { "identifier": "02778", "modelField": ["3", "GA"] },
            { "identifier": "05143" },
            { "identifier": "02916" }
          ],
          "ECOAInquiryType": "Individual"
        }
      }
    })
  });
  return response.json();
}
function parseCreditReport(data) {
  if (!data.consumers || !data.consumers.equifaxUSConsumerCreditReport || !data.consumers.equifaxUSConsumerCreditReport[0].trades) {
    console.error("Invalid data structure:", data);
    return [];
  }
  const trades = data.consumers.equifaxUSConsumerCreditReport[0].trades;
  return trades.map((trade) => {
    const creditLimit = trade.creditLimit || 0;
    const currentAmount = trade.highCredit || 0;
    const creditUtilization = creditLimit > 0 ? (currentAmount / creditLimit * 100).toFixed(2) + "%" : "Not specified";
    return {
      creditor: trade.customerName || "Not specified",
      accountNumber: trade.accountNumber ? trade.accountNumber.toString() : "Not specified",
      debtType: trade.accountTypeCode && trade.accountTypeCode.description ? trade.accountTypeCode.description : "Not specified",
      currentAmount: currentAmount ? `$${currentAmount}` : "Not specified",
      creditLimit: creditLimit ? `$${creditLimit}` : "Not specified",
      creditUtilization,
      whoseDebt: trade.accountDesignator && trade.accountDesignator.code ? trade.accountDesignator.code === "I" ? "Individual" : "Joint" : "Not specified",
      currentPayment: trade.actualPaymentAmount ? `$${trade.actualPaymentAmount}` : "Not specified",
      lastPaymentDate: trade.lastPaymentDate ? trade.lastPaymentDate.replace(/(\d{2})(\d{2})(\d{4})/, "$2/$1/$3") : "Not specified",
      settlementNotes: trade.rate && trade.rate.description ? trade.rate.description : "Not specified",
      summons: "No",
      enrolled: "1"
    };
  });
}
var handler = async (event, context) => {
  try {
    const consumerDetails = JSON.parse(event.body);
    const tokenResponse = await getAccessToken();
    if (tokenResponse.access_token) {
      const reportResponse = await getCreditReport(tokenResponse.access_token, consumerDetails);
      const creditReport = parseCreditReport(reportResponse);
      return {
        statusCode: 200,
        body: JSON.stringify({ creditReport })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to obtain access token" })
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
