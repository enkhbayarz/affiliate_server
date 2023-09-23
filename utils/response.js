function sendSuccess(res, message, statusCode, body = {}) {
  const response = {
    success: true,
    message,
    body,
  };

  res.status(statusCode).json(response);
}

function sendError(res, message, statusCode) {
  const response = {
    success: false,
    message,
  };

  res.status(statusCode).json(response);
}

module.exports = { sendSuccess, sendError };
