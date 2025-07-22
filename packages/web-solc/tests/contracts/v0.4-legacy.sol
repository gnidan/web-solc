pragma solidity ^0.4.0;

contract Test {
  uint public value;
  
  // Function-named constructor for 0.4.0 - 0.4.21
  function Test() public {
    value = 42;
  }
  
  function getValue() public view returns (uint) {
    return value;
  }
}
