pragma solidity ^0.6.0;

contract Test {
  uint256 public value;
  
  constructor() public {
    value = 42;
  }
  
  function getValue() public view returns (uint256) {
    return value;
  }
}
