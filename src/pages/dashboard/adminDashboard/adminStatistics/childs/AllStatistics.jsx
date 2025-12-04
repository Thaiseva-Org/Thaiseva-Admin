import { addDays } from "date-fns";
import { useContext, useEffect, useState } from "react";
// import { DateRange } from "react-date-range";
// import "react-date-range/dist/styles.css"; // main style file
// import "react-date-range/dist/theme/default.css"; // theme css file
// import LineAndBarChart from "../../../../../components/LineAndBarChart";
import { StatisticsContext } from "../../../../../contextAPIs/StatisticsProvider";
import {
  AccountBalanceWalletIcon,
  ApartmentIcon,
  LocalTaxiRoundedIcon,
  LuggageIcon,
  DirectionsCarIcon,
  // HandshakeIcon,
} from "../../../../../utils/Icons";
import { amountCalculator } from "../../../../../utils/utils";
import BarEarningChart from "../../../../../components/BarEarningChart";
import {
  Button,
  FormControl,
  // InputAdornment,
  MenuItem,
  // OutlinedInput,
  Select,
} from "@mui/material";

const AllStatistics = () => {
  const {
    allStatistics,
    selectedView,
    setSelectedView,
    setMonth,
    setYear,
    month,
    year,
    filterRange,
  } = useContext(StatisticsContext);
  // const [dates, setDates] = useState([
  //   {
  //     startDate: new Date(),
  //     endDate: addDays(new Date(), 2),
  //     key: "selection",
  //   },
  // ]);
  // const [isOpenCalendar, setIsOpenCalendar] = useState(false);
  // const [selectedView, setSelectedView] = useState("Days");
  const [filteredAll, setFilteredAll] = useState([]);
  const [filteredHotel, setFilteredHotel] = useState([]);
  const [filteredTaxi, setFilteredTaxi] = useState([]);
  const [filteredSelfdrive, setFilteredSelfdrive] = useState([]);
  const [filteredSightseeing, setFilteredSightseeing] = useState([]);
  const [chartType, setChartType] = useState("Bar");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const currentYear = new Date().getFullYear();
  const years = Array.from(
    { length: currentYear - 2025 + 1 },
    (_, i) => currentYear - i
  );
  const now = new Date();
  now.setMonth(now.getMonth() - 1); // Set to Current Month - 1
  // const maxMonth = now.toISOString().slice(0, 7);

  useEffect(() => {
    setFilteredAll(allStatistics.Total);
    setFilteredHotel(allStatistics.Hotels);
    setFilteredTaxi(allStatistics.Cars);
    setFilteredSelfdrive(allStatistics.SelfDrive);
    setFilteredSightseeing(allStatistics.Sightseeing);
  }, [allStatistics]);

  // const filterByDate = () => {
  //   const date1 = new Date(dates[0].startDate).toLocaleDateString();
  //   const date2 = new Date(dates[0].endDate).toLocaleDateString();

  //   const array1 = allStatistics.filter((item) => {
  //     const itemDate = dateCalculator(item.date);
  //     if (itemDate >= date1 && itemDate <= date2) {
  //       return item;
  //     }
  //   });
  //   const array2 = allStatistics.Hotels.filter((item) => {
  //     const itemDate = dateCalculator(item.date);
  //     if (itemDate >= date1 && itemDate <= date2) {
  //       return item;
  //     }
  //   });
  //   const array3 = allStatistics.Cars.filter((item) => {
  //     const itemDate = dateCalculator(item.date);
  //     if (itemDate >= date1 && itemDate <= date2) {
  //       return item;
  //     }
  //   });
  //   const array4 = allStatistics.SelfDrive.filter((item) => {
  //     const itemDate = dateCalculator(item.date);
  //     if (itemDate >= date1 && itemDate <= date2) {
  //       return item;
  //     }
  //   });
  //   const array5 = allStatistics.Sightseeing.filter((item) => {
  //     const itemDate = dateCalculator(item.date);
  //     if (itemDate >= date1 && itemDate <= date2) {
  //       return item;
  //     }
  //   });

  //   setFilteredAll(array1);
  //   setFilteredHotel(array2);
  //   setFilteredTaxi(array3);
  //   setFilteredSelfdrive(array4);
  //   setFilteredSightseeing(array5);
  // };

  // const handleChangeQueryText = (e) => {
  //   // const year = new Date().getFullYear(); todo
  //   const year = 2023;
  //   if (e === "days") {
  //     return setQueryText(`${year}_${e}`);
  //   } else if (e === "months") {
  //     return setQueryText(`${year}_${e}`);
  //   } else {
  //     setQueryText(e);
  //   }
  // };

  // console.log(
  //   filteredAll,
  //   filteredHotel,
  //   filteredSightseeing,
  //   filteredSelfdrive,
  //   filteredTaxi
  // );
  const allTotal = amountCalculator(filteredAll);
  const hotelTotal = amountCalculator(filteredHotel);
  const SightseeingTotal = amountCalculator(filteredSightseeing);
  const taxiTotal = amountCalculator(filteredTaxi);
  const SelfdriveTotal = amountCalculator(filteredSelfdrive);

  return (
    <div className="common-layout">
      {/* <h3 className="text-xl font-bold text-center border-y bg-slate-200  text-[var(--primary-bg)] mb-3">
        All Statistics
      </h3> */}
      <div className="flex items-center justify-between gap-2">
        {/* <select
          name=""
          id=""
          // onChange={(e) => handleChangeQueryText(e.target.value)}
          className="border-2 border-[var(--primary-bg)] py-1.5 px-2 h-full rounded-md"
        >
          <option value="days">Days</option>
          <option value="months">Months</option>
          <option value="years">Years</option>
        </select>
        <select
          name=""
          id=""
          onChange={(e) => setChartType(e.target.value)}
          className="border-2 border-[var(--primary-bg)] py-1.5 px-2 h-full rounded-md"
        >
          <option value="bar">Bar</option>
          <option value="line">Line</option>
        </select> */}
        <div>
          <FormControl sx={{ m: 1, minWidth: 105 }} size="small">
            <Select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              displayEmpty
              inputProps={{ "aria-label": "Without label" }}
            >
              <MenuItem value={"Days"}>Days</MenuItem>
              <MenuItem value={"Months"}>Months</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 90 }} size="small">
            <Select
              value={chartType}
              onChange={(e) => setChartType(e.target.value)}
              displayEmpty
              inputProps={{ "aria-label": "Without label" }}
            >
              <MenuItem value={"Bar"}>Bar</MenuItem>
              <MenuItem value={"Line"}>Line</MenuItem>
            </Select>
          </FormControl>
        </div>
        <div className="flex">
          <FormControl sx={{ m: 1, minWidth: 90 }} size="small">
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              displayEmpty
              inputProps={{ "aria-label": "Without label" }}
            >
              {months.map((val, i) => (
                <MenuItem
                  value={val}
                  key={i}
                  disabled={
                    year == new Date().getFullYear() &&
                    i > new Date().getMonth() - 1
                  }
                >
                  {val}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ m: 1, minWidth: 90 }} size="small">
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              displayEmpty
              inputProps={{ "aria-label": "Without label" }}
            >
              {years.map((val, i) => (
                <MenuItem value={val} key={i}>
                  {val}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <div className="m-1 flex items-center">
            <Button variant="contained" onClick={filterRange}>
              Go
            </Button>
          </div>
        </div>
        {/* {selectedView.includes("Days") && (
          <div className="relative flex">
            <FormControl
              sx={{ m: 1, width: "25ch" }}
              variant="outlined"
              size="small"
            >
              <OutlinedInput
                endAdornment={<InputAdornment position="end"></InputAdornment>}
                aria-describedby="outlined-weight-helper-text"
                onClick={() => setIsOpenCalendar((p) => !p)}
                value={`${new Date(
                  dates[0].startDate
                ).toLocaleDateString()} to ${new Date(
                  dates[0].endDate
                ).toLocaleDateString()}`}
                readOnly
              />
            </FormControl>
            <div className="h-full m-auto">
              <Button
                className="m-auto"
                variant="contained"
                onClick={filterByDate}
              >
                Go
              </Button>
            </div>
            {isOpenCalendar && (
              <div className="absolute z-10 top-10">
                <button
                  onClick={() => setIsOpenCalendar(false)}
                  className="absolute top-3 right-3 z-10 bg-red-400 h-6 w-6 text-white rounded-full font-bold"
                >
                  X
                </button>
                <DateRange
                  onChange={(item) => setDates([item.selection])}
                  editableDateInputs={true}
                  moveRangeOnFirstSelection={false}
                  retainEndDateOnFirstSelection={true}
                  showSelectionPreview={true}
                  // moveRangeOnFirstSelection={false}
                  months={1}
                  ranges={dates}
                  direction="horizontal"
                  className="hidden border border-[var(--primary-bg)] rounded"
                />
              </div>
            )}
          </div>
        )} */}
      </div>
      <div className="flex flex-col">
        <div className="md:w-[80%] m-auto w-screen min-h-[50vh]">
          {/* <LineAndBarChart
            title="All Statistics"
            all={filteredAll}
            hotelStatistics={filteredHotel}
            localStatistics={filteredLocal}
            travelStatistics={filteredTravel}
            chartType={chartType}
          /> */}
          <BarEarningChart
            selectedView={selectedView}
            chartType={chartType}
            statsData={allStatistics}
          />
        </div>
        {/* <div className="flex-grow p-2 flex flex-col items-center justify-center gap-3">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white p-2 rounded flex flex-row items-center justify-start w-52">
            <ApartmentIcon sx={{ height: 50, width: 50 }} />
            <div>
              <h3 className="text-lg -mb-2">Hotel</h3>
              <span className="text-2xl font-bold">฿{hotelTotal}</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-green-600 to-cyan-500 text-white p-2 rounded flex flex-row items-center justify-start w-52">
            <HandshakeIcon sx={{ height: 50, width: 50 }} />

            <div>
              <h3 className="text-lg -mb-2">
                <span>Local Services</span>
              </h3>
              <span className="text-2xl font-bold">฿{localTotal}</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-yellow-600 to-cyan-500 text-white p-2 rounded flex flex-row items-center justify-start w-52">
            <DirectionsCarIcon sx={{ height: 50, width: 50 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span>Travel</span>
              </h3>
              <span className="text-2xl font-bold">฿{travelTotal}</span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[var(--primary-bg)] to-cyan-500 text-white p-2 rounded flex flex-row items-center justify-start w-52">
            <AccountBalanceWalletIcon sx={{ height: 50, width: 50 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span>Total</span>
              </h3>
              <span className="text-2xl font-bold">฿{allTotal}</span>
            </div>
          </div>
        </div> */}
        <div className="flex-wrap p-2 flex flex-row items-center justify-evenly gap-3 mt-5">
          <div className="bg-[#be0aff] text-white px-3 py-2 gap-2 rounded flex flex-row items-center justify-start min-w-[150px]">
            <AccountBalanceWalletIcon sx={{ height: 40, width: 40 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span className="font-semibold">Total</span>
              </h3>
              <span className="text-2xl font-bold">฿{allTotal}</span>
            </div>
          </div>

          <div className="bg-[#ffd000] text-white rounded flex flex-row items-center justify-start px-3 py-2 gap-2  min-w-[150px]">
            <ApartmentIcon sx={{ height: 40, width: 40 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span className="font-semibold">Hotels</span>
              </h3>
              <span className="text-2xl font-bold">฿{hotelTotal}</span>
            </div>
          </div>

          <div className="bg-[#0c63e7] text-white px-3 py-2 gap-2 rounded flex flex-row items-center justify-start  min-w-[150px]">
            <LuggageIcon sx={{ height: 40, width: 40 }} />

            <div>
              <h3 className="text-lg -mb-2">
                <span className="font-semibold">Sightseeing</span>
              </h3>
              <span className="text-2xl font-bold">฿{SightseeingTotal}</span>
            </div>
          </div>

          <div className="bg-[#55AD9B] text-white px-3 py-2 gap-2 rounded flex flex-row items-center justify-start min-w-[150px]">
            <LocalTaxiRoundedIcon sx={{ height: 40, width: 40 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span className="font-semibold">Taxi</span>
              </h3>
              <span className="text-2xl font-bold">฿{taxiTotal}</span>
            </div>
          </div>

          <div className="bg-[#ee1e3a] text-white px-3 py-2 gap-2 rounded flex flex-row items-center justify-start  min-w-[150px]">
            <DirectionsCarIcon sx={{ height: 40, width: 40 }} />
            <div>
              <h3 className="text-lg -mb-2">
                <span className="font-semibold">Self Drive</span>
              </h3>
              <span className="text-2xl font-bold">฿{SelfdriveTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AllStatistics;
