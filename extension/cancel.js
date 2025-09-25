exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h1>❌ Payment Canceled</h1>
          <p>No worries, maybe next time 🙂</p>
        </body>
      </html>
    `
  };
};
