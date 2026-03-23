# 📱 Huấn luyện: Đăng nhập SĐT qua Firebase (Phone Authentication)

Tài liệu này hướng dẫn quy trình từ thiết lập Firebase Console đến cách viết code cho Frontend (React Native) và Backend (Node.js).

---

## 🛠️ Bước 1: Thiết lập trên Firebase Console

1.  **Tạo dự án**: Truy cập [Firebase Console](https://console.firebase.google.com/), tạo dự án mới (ví dụ: `VibeCheck`).
2.  **Bật Phone Auth**:
    - Vào **Authentication** > **Sign-in method**.
    - Chọn **Phone** và bật **Enable**.
3.  **Thêm Ứng dụng (Android/iOS)**:
    - **Android**: Nhập Package Name (xem trong `android/app/src/main/AndroidManifest.xml`).
    - **Quan trọng**: Bạn **BẮT BUỘC** phải lấy mã **SHA-1** hoặc **SHA-256** từ máy thiết bị của bạn điền vào Firebase để Firebase hỗ trợ reCAPTCHA/SafetyNet.
      - Chạy lệnh trong thư mục `android`: `./gradlew signingReport` để lấy SHA-1.
    - **Tải file cấu hình**: 
      - Tải `google-services.json` bỏ vào `d:\BCTT\VibeCheck\android\app\`.
      - Tải `GoogleService-Info.plist` bỏ vào `d:\BCTT\VibeCheck\ios\`.

---

## ⚛️ Bước 2: Frontend (React Native) - Firebase Auth

Để xử lý xác thực trên Mobile, bạn nên sử dụng **React Native Firebase** (thư viện Native).

1.  **Cài đặt**:
    ```bash
    npm install @react-native-firebase/app @react-native-firebase/auth
    ```
2.  **Quy trình lấy Mã OTP**:
    - Người dùng nhập SĐT.
    - Gọi: `const confirmation = await auth().signInWithPhoneNumber('+84xxxxxxxxx');`
    - Firebase sẽ gửi mã OTP đến máy người dùng.
    - Hiển thị màn hình nhập OTP.
3.  **Xác minh OTP**:
    - Gọi: `await confirmation.confirm('123456');`
    - Khi thành công, người dùng đã đăng nhập vào Firebase.
4.  **Lấy ID Token để gửi cho Backend**:
    - Gọi: `const idToken = await auth().currentUser.getIdToken();`
    - Gửi `idToken` này lên API `/api/auth/firebase-login` của Backend.

---

## 🟢 Bước 3: Backend (Node.js) - Xác thực và Tạo Session

Backend sẽ không tin tưởng mã token từ client gửi lên mà phải verify với Firebase Admin SDK.

1.  **Thiết lập Backend**:
    - Bạn sẽ cần lấy **Service Account Key** từ Firebase Console (**Project settings > Service accounts**).
    - Tải file `.json` về, cấu hình trong `.env` Backend (`FIREBASE_PRIVATE_KEY`, v.v.).

2.  **Luồng xử lý API Backend (`/api/auth/firebase-login`)**:

```javascript
// Sample logic trong auth.controller.js hoặc auth.service.js
const admin = require('firebase-admin');

const verifyFirebaseToken = async (idToken) => {
  try {
    // 1. Verify token nhận từ Frontend
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { phone_number, uid } = decodedToken;

    // 2. Kiểm tra User trong MongoDB
    let user = await User.findOne({ phone: phone_number });
    if (!user) {
      // Đăng ký mới nếu chưa có
      user = await User.create({
        phone: phone_number,
        firebaseUid: uid,
        displayName: 'User_' + phone_number.slice(-4)
      });
    }

    // 3. Tạo JWT riêng của hệ thống bạn (AccessToken, RefreshToken)
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    return { user, accessToken, refreshToken };
  } catch (error) {
    throw new Error('Xác thực Firebase thất bại: ' + error.message);
  }
};
```

---

## 💡 Xử lý Biến Môi Trường (.env) trên Frontend

Vì React Native không có `process.env` mặc định an toàn:
1.  Tôi đã tạo file `.env` tại gốc thư mục FE.
2.  Để sử dụng, bạn cần cài đặt `react-native-config` để liên kết từ Native.
    - Nếu bạn muốn tôi cấu hình tự động luôn, hãy phản hồi lại (có thể can thiệp file Android/iOS).
