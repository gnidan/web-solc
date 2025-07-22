pragma solidity ^0.8.0;

contract ErrorContract {
    function badFunction() public {
        uint256 x = ; // Syntax error
    }
}
