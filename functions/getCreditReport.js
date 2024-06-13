import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;

const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

async function getAccessToken() {
    const response = await fetch('https://api.sandbox.equifax.com/v2/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials&scope=https://api.equifax.com/business/oneview/consumer-credit/v1'
    });
    return response.json();
}

async function getCreditReport(accessToken, consumerDetails) {
    const response = await fetch('https://api.sandbox.equifax.com/business/oneview/consumer-credit/v1/reports/credit-report', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'efx-client-correlation-id': 'your-correlation-id-here'
        },
        body: JSON.stringify({
            "consumers": {
                "name": [{"identifier": "current", "firstName": consumerDetails.firstName, "lastName": consumerDetails.lastName}],
                "socialNum": [{"identifier": "current", "number": consumerDetails.socialSecurityNumber}],
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
                        {"identifier": "02778", "modelField": ["3", "GA"]},
                        {"identifier": "05143"},
                        {"identifier": "02916"}
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
        console.error('Invalid data structure:', data);
        return [];
    }

    const trades = data.consumers.equifaxUSConsumerCreditReport[0].trades;
    return trades.map(trade => {
        const creditLimit = trade.creditLimit || 0;  // Assuming 'creditLimit' is the field name.
        const currentAmount = trade.highCredit || 0;
        const creditUtilization = (creditLimit > 0) ? ((currentAmount / creditLimit) * 100).toFixed(2) + '%' : "Not specified";
        
        return {
            creditor: trade.customerName || "Not specified",
            accountNumber: trade.accountNumber ? trade.accountNumber.toString() : "Not specified",
            debtType: trade.accountTypeCode && trade.accountTypeCode.description ? trade.accountTypeCode.description : "Not specified",
            currentAmount: currentAmount ? `$${currentAmount}` : "Not specified",
            creditLimit: creditLimit ? `$${creditLimit}` : "Not specified",
            creditUtilization: creditUtilization,
            whoseDebt: trade.accountDesignator && trade.accountDesignator.code ? (trade.accountDesignator.code === 'I' ? "Individual" : "Joint") : "Not specified",
            currentPayment: trade.actualPaymentAmount ? `$${trade.actualPaymentAmount}` : "Not specified",
            lastPaymentDate: trade.lastPaymentDate ? trade.lastPaymentDate.replace(/(\d{2})(\d{2})(\d{4})/, '$2/$1/$3') : "Not specified",
            settlementNotes: trade.rate && trade.rate.description ? trade.rate.description : "Not specified",
            summons: "No",
            enrolled: "1"
        };
    });
}

export const handler = async (event, context) => {
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
