pragma solidity ^0.4.22;

contract Test {
  uint public value;
  
  constructor() public {
    value = 42;
  }
  
  function getValue() public view returns (uint) {
    return value;
  }
}
