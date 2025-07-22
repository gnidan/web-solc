pragma solidity ^0.5.0;

contract Test {
  uint256 public value;
  
  constructor() public {
    value = 42;
  }
  
  function getValue() public view returns (uint256) {
    return value;
  }
}
