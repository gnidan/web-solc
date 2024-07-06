import { useState } from "react";
import "./App.css";

import { fetchSolc } from "web-solc";

export default function App() {
  const [output, setOutput] = useState("");

  const compile = async () => {
    try {
      const solc = await fetchSolc("^0.8.0");
      const result = await solc.compile({
        language: "Solidity",
        sources: {
          "test.sol": {
            content: "pragma solidity ^0.8.0; contract Test {}"
          }
        },
        settings: {
          outputSelection: {
            "*": {
              "*": ["*"]
            }
          }
        }
      });
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(String(error));
    }
  }

  return (
    <div>
      <h1>Web Solc Example</h1>
      <button onClick={compile}>Compile</button>
      <pre>{output}</pre>
    </div>
  )
}
