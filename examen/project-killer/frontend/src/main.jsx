
import React from "react";
import { createRoot } from "react-dom/client";

const API = "http://localhost:3000";

function App() {
  const [data, setData] = React.useState(null);
  React.useEffect(() => {
    fetch(API + "/api/health")
      .then(r => r.json())
      .then(setData)
      .catch(console.error);
  }, []);

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}

createRoot(document.getElementById("root")).render(<App />);
