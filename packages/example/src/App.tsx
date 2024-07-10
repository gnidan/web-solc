import { useState } from "react";
import "./App.css";

import { WebSolcProvider, useWebSolc } from "@web-solc/react";

export function Example() {
  const solc = useWebSolc("^0.8.25");
  const [output, setOutput] = useState("");

  if (!solc) {
    return <>Loading...</>;
  }

  const compile = async () => {
    try {
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

export default function App() {
  return (
    <WebSolcProvider>
      <Example />
    </WebSolcProvider>
  )
}
