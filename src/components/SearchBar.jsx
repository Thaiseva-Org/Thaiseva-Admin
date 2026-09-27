import { Grid, TextField, InputAdornment } from "@mui/material";
import { Link } from "react-router-dom";
import { SearchIcon } from "@icons";

const SearchBar = ({
  handleSearch,
  handleOpenModal = () => {},
  btnTitle,
  to = "",
  btn = true,
}) => {
  return (
    <div className="mb-6 animate-slide-up">
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={btn ? 8 : 12} md={btn ? 9 : 12}>
          <TextField
            placeholder="Search here..."
            type="search"
            fullWidth
            variant="outlined"
            size="medium"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className="text-neutral-400" />
                </InputAdornment>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                backgroundColor: "white",
                borderRadius: "12px",
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundColor: "#f8fafc",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#3b82f6",
                  },
                },
                "&.Mui-focused": {
                  backgroundColor: "white",
                  boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
                  "& .MuiOutlinedInput-notchedOutline": {
                    borderColor: "#3b82f6",
                    borderWidth: "2px",
                  },
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#e5e7eb",
                },
              },
              "& .MuiInputLabel-root": {
                color: "#64748b",
              },
            }}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </Grid>
        {btn && (
          <Grid item xs={12} sm={4} md={3}>
            <div className="flex items-center justify-end h-full">
              {!to ? (
                <button 
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                  onClick={handleOpenModal}
                >
                  <span className="text-xl">+</span>
                  {btnTitle}
                </button>
              ) : (
                <Link
                  to={to}
                  target="_blank"
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">+</span>
                  {btnTitle}
                </Link>
              )}
            </div>
          </Grid>
        )}
      </Grid>
    </div>
  );
};

export default SearchBar;
