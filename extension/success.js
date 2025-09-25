exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1>✅ Payment Successful</h1>
          <p>Thank you for your support!</p>
        </body>
      </html>
    `
  };
};
