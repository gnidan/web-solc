import { useState } from "react";
import "./App.css";

import { WebSolcProvider, useWebSolc } from "@web-solc/react";

export function Example() {
  const compiler = useWebSolc({ version: "^0.8.25" });
  const [output, setOutput] = useState("");

  if (compiler.loading) {
    return <>Loading...</>;
  }

  if (compiler.error) {
    return <>Error: {compiler.error.message}</>;
  }

  const compile = async () => {
    try {
      const result = await compiler.compile({
        language: "Solidity",
        sources: {
          "test.sol": {
            content: "pragma solidity ^0.8.0; contract Test {}",
          },
        },
        settings: {
          outputSelection: {
            "*": {
              "*": ["*"],
            },
          },
        },
      });
      setOutput(JSON.stringify(result, null, 2));
    } catch (error) {
      setOutput(String(error));
    }
  };

  return (
    <div>
      <h1>Web Solc Example</h1>
      <button onClick={compile}>Compile</button>
      <pre>{output}</pre>
    </div>
  );
}

// Example showing preloaded compiler
export function ExampleWithPreloadedCompiler() {
  // Imagine this is fetched from somewhere
  const soljson = "..."; // Would be actual soljson content

  const compiler = useWebSolc({ soljson });

  if (compiler.loading) return <>Loading preloaded compiler...</>;
  if (compiler.error) return <>Error: {compiler.error.message}</>;

  // Use compiler.compile as before
  return <div>Preloaded compiler ready!</div>;
}

export default function App() {
  return (
    <WebSolcProvider>
      <Example />
    </WebSolcProvider>
  );
}
