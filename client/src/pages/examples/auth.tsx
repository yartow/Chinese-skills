import AuthPage from "../auth";

export default function AuthPageExample() {
  return <AuthPage onLogin={() => console.log("Logged in")} />;
}
