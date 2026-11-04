import uvicorn

if __name__ == "__main__":
    print("Starting AI Smart Assessment & Quiz Engine on http://localhost:8000 ...")
    print("Interactive Swagger Documentation available at http://localhost:8000/docs")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
