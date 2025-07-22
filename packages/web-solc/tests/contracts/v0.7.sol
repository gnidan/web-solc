pragma solidity ^0.7.0;

contract Test {
  uint256 public value;
  
  constructor() {
    value = 42;
  }
  
  function getValue() public view returns (uint256) {
    return value;
  }
}
