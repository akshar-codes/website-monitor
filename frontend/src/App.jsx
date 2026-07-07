import React from "react";
import { Button, Typography, Container, Box } from "@mui/material";

function App() {
  return (
    // Using Tailwind for layout and background (min-h-screen, flex, bg-gray-100)
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {/* Using MUI Container and Box with Tailwind for padding and shadows */}
      <Container maxWidth="sm">
        <Box className="p-8 bg-white rounded-2xl shadow-xl text-center">
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            className="font-bold text-gray-800"
          >
            Frontend Initialized
          </Typography>

          <Typography variant="body1" className="mb-6 text-gray-600">
            React + Material UI + Tailwind CSS
          </Typography>

          {/* MUI Button */}
          <Button variant="contained" color="primary" size="large">
            Get Started
          </Button>
        </Box>
      </Container>
    </div>
  );
}

export default App;
