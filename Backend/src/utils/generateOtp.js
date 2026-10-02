const generateOtp = () => {
  // 6-digit numeric OTP, e.g. "482917"
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export default generateOtp;