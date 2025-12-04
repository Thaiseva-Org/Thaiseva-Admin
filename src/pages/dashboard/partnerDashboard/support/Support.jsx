import { Box, Button, Grid, Paper, TextField } from "@mui/material";
import PageHeading from "../../../../components/PageHeading";
import { useState } from "react";

const Support = () => {
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    message: "",
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    const email = "thaiseva@gmail.com";
    const subject = encodeURIComponent(formData.subject);
    const body = encodeURIComponent(`${formData.message}`);

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div>
      <PageHeading text={"Admin Support"} />

      <div className="flex lg:flex-row flex-col">
        <div className="flex-1">
          <Paper
            elevation={3}
            sx={{
              p: { xs: 2, sm: 3, md: 4 },
              mt: 3,
              mx: "auto",
              height: "fit-content",
              width: { xs: "100%", sm: "100%", md: "60%" },
            }}
          >
            <h3 className="text-center text-[var(--primary-bg)] font-bold md:text-xl mb-3">
              Need help? Write here we will response as soon as possible.
            </h3>
            <Box component="form" onSubmit={handleSubmit}>
              <Grid container spacing={{ xs: 1, sm: 2, md: 3 }}>
                {/* Email */}
                {/* <Grid item xs={12}>
                  <TextField
                    label="Email"
                    type="email"
                    name="email"
                    defaultValue=""
                    fullWidth
                  />
                </Grid> */}

                {/* Subject */}
                <Grid item xs={12}>
                  <TextField
                    label="Subject"
                    type="text"
                    name="subject"
                    autoComplete="off"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    fullWidth
                  />
                </Grid>

                {/* Message */}
                <Grid item xs={12}>
                  <TextField
                    id="outlined-multiline-flexible"
                    label="Message"
                    multiline
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    fullWidth
                    rows={4}
                  />
                </Grid>
              </Grid>
              <Box textAlign="center" sx={{ mt: 2 }}>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{
                    bgcolor: "var(--button-bg-color)",
                    color: "white",
                    hover: "none",
                  }}
                  className="add-new-btn"
                >
                  Send
                </Button>
              </Box>
            </Box>
          </Paper>
        </div>
      </div>
    </div>
  );
};

export default Support;
