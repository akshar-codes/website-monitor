import { useState, useEffect } from "react";

function App() {
  const [serverStatus, setServerStatus] = useState("Checking...");

  useEffect(() => {
    // Fetch data from our Express backend
    fetch("http://localhost:5000/api/health")
      .then((res) => res.json())
      .then((data) => setServerStatus(data.message))
      .catch((err) => setServerStatus("Backend is offline ❌", err));
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>Website Monitor Dashboard</h1>
      <p>
        Backend Status: <strong>{serverStatus}</strong>
      </p>
    </div>
  );
}

export default App;
