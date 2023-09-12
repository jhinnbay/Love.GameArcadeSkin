import { ethers } from "ethers";
import { useState } from "react";
import { formatUnits } from "viem";
import { erc20ABI } from "wagmi";
import { contractAddressLove } from "../../utils/constant";
import { fetchLovePriceUSDT } from "./poolCalcUtils";
import { AppContracts } from "../AppContracts";
import { PoolAbi } from "../PoolAbi";
import { LoveFarmAbi } from "../LoveFarmAbi";

const lpContractAbi = require("../../utils/poolABI.json");

type UserPoolData = {
  pendingLove: string;
  stakedValue: number;
  availableBalance: any;
  userValueStaked: any;
  lpTokenBalance: ethers.BigNumber;
  lpBalanceStake: any;
  EthUser: number;
  LoveUser: number;
  unstakedLiquidity: number;
  lpAvailable: number;
};

export const useFetchUserPoolData = () => {
  const [userPoolData, setUserPoolData] = useState<UserPoolData>();
  const [userDataPending, setUserDataPending] = useState(false);
  const getPoolUserData = async (
    poolIndex: number,
    address: string,
    lpContractAddress: string
  ) => {
    setUserDataPending(true);
    try {
      const provider = new ethers.providers.Web3Provider(
        (window as any).ethereum
      );

      // Dynamically create a contract based on the pool's LP token address.
      const lpContract = new ethers.Contract(
        lpContractAddress,
        lpContractAbi,
        provider
      ) as PoolAbi;

      const { loveFarmContract, loveTokenContract, usdtLovePoolContract } = new AppContracts(
        provider
      );

      const pendingLoveValue: any = await loveFarmContract.pendingLove(
        poolIndex,
        address
      );
      const realValue = await getAvailableRealValue(
        loveTokenContract,
        address!
      );
      const userInfo = await loveFarmContract.userInfo(poolIndex, address);
      const lpAvailable = await getAvailableToken(lpContract, address!);
      const availableStaked = Number(userInfo.amount.toString()) > 0 ? 1 : 0;
      const userValueStaked = userInfo.amount;
      const loveEthLpTokenBalance = await lpContract.balanceOf(address!);

      const getLpInformation = await getTokenInformation(
        lpContract,
        loveFarmContract,
        usdtLovePoolContract,
        address!,
        poolIndex,
        provider
      );

      const data = {
        pendingLove: Number(formatUnits(pendingLoveValue, 18)).toFixed(2),
        stakedValue: availableStaked,
        availableBalance: realValue,
        userValueStaked,
        lpTokenBalance: loveEthLpTokenBalance,
        lpBalanceStake: getLpInformation.lpBalance,
        EthUser: getLpInformation.EthPerUser,
        LoveUser: getLpInformation.lovePerUser,
        unstakedLiquidity: getLpInformation.unstakedLiquidity,
        lpAvailable,
      };
      console.log(data);
      setUserPoolData(data);
      setUserDataPending(false);
    } catch (err) {
      console.log(err);
      setUserDataPending(false);
    }
  };

  const getAvailableToken = async (contractToken: any, address: string) => {
    try {
      const value = await contractToken.balanceOf(address);
      if (value > 0) {
        return 1;
      } else {
        return 0;
      }
    } catch (error) {
      return 0;
    }
  };

  const getAvailableRealValue = async (contractToken: any, address: string) => {
    try {
      const value = await contractToken.balanceOf(address);
      return value;
    } catch (error) {
      return 0;
    }
  };

  const getTokenInformation = async (
    lpContract: any,
    farmContract: LoveFarmAbi,
    usdtLovePoolContract: PoolAbi,
    address: string,
    poolIndex: number,
    provider: ethers.providers.Provider
  ) => {
    const LOVEPriceInUSDT = await fetchLovePriceUSDT(usdtLovePoolContract);
    const userInfo = await farmContract.userInfo(poolIndex, address);
    const lpTotalSupply = await lpContract.totalSupply();
    const lpToken0 = await lpContract.token0();
    const lpToken1 = await lpContract.token1();
    const lpReserves = await lpContract.getReserves();
    const lpBalanceUser = userInfo.amount;
    
    const token0IsLOVE = lpToken0 == contractAddressLove;
  
    const LOVEKey = token0IsLOVE ? `_reserve0` : `_reserve1`;
    const LOVEReservesBN = lpReserves[LOVEKey];

    const tokenKey = token0IsLOVE ? `_reserve0` : `_reserve1`;
    const tokenReservesBN = lpReserves[tokenKey];
    const tokenAddress = token0IsLOVE ? lpToken1 : lpToken0;
    const tokenContract = new ethers.Contract(
      tokenAddress,
      erc20ABI,
      provider
    );
    const tokenDecimals = await tokenContract.decimals();

    const tokensPerUserBN = tokenReservesBN
      .mul(lpBalanceUser)
      .div(lpTotalSupply);
    const tokensPerUser = Number(ethers.utils.formatUnits(tokensPerUserBN, tokenDecimals));
    
    const LOVEPerUserBN = LOVEReservesBN
      .mul(lpBalanceUser)
      .div(lpTotalSupply);
    const LOVEPerUser = Number(ethers.utils.formatUnits(LOVEPerUserBN, 18));
    const LOVEInFarmValueUSDT = LOVEPerUser * LOVEPriceInUSDT;
    const totalValue = LOVEInFarmValueUSDT * 2;

    return {
      lpBalance: lpBalanceUser.toString(),
      EthPerUser: tokensPerUser,
      lovePerUser: LOVEPerUser,
      unstakedLiquidity: totalValue,
    };
  };

  return {
    onGetUserPoolData: getPoolUserData,
    userPoolData,
    userDataPending,
  };
};
