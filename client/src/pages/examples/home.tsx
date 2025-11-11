import HomePage from "../home";

export default function HomePageExample() {
  return (
    <HomePage
      onCharacterClick={(id) => console.log("Character clicked:", id)}
      onLogout={() => console.log("Logout clicked")}
    />
  );
}
