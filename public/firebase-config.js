// Public web app configuration for the AgroEstimate Firebase project.
// This public configuration is not a service-account key.
export const firebaseConfig = {
  apiKey: "AIzaSyD4RqVr0oh-_qrtUsZNFGoOvuUEyTKPars",
  authDomain: "agroestimate.firebaseapp.com",
  projectId: "agroestimate",
  storageBucket: "agroestimate.firebasestorage.app",
  messagingSenderId: "124879667703",
  appId: "1:124879667703:web:2211553481c85fb2352ef2",
  measurementId: "G-CNWKM4LFR4"
};

// Login alias only; Firebase still verifies the password and Firestore admin permission.
export const adminLogin = { username: "Admin", email: "ananyaaol07@gmail.com" };

// Enable only after adminUpdateUser has been successfully deployed.
export const adminEmailEditingEnabled = false;
