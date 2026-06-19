import os

file_path = "/Users/rishibhardwaj/Desktop/Clinical-Insight-Engine/server/routes.ts"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Add the import at the beginning
new_lines = []
# We'll put 'import { api } from "@shared/routes";' as the second line
new_lines.append(lines[0])
new_lines.append('import { api } from "@shared/routes";\n')

# Add the rest of the lines up to index 168 (line 169)
new_lines.extend(lines[1:169])

# Modify the mounting lines
new_lines.append('  app.use("/api/assessments", generalLimiter, assessmentsRouter);\n')
new_lines.append('  app.use("/api/assessments", mlRouter);\n')
new_lines.append('  app.use("/api/assessments", exportsRouter);\n')
new_lines.append('  app.use("/api/assessments", generalLimiter, analyticsRouter);\n')

# Skip from index 173 (line 174) to index 697 (line 698) inclusive.
# Keep from index 698 onwards
new_lines.extend(lines[698:])

# Print the lines around the edit area to double check
print("--- PREVIEW OF MODIFIED AREA ---")
for i in range(160, 185):
    if i < len(new_lines):
        print(f"{i+1}: {new_lines[i]}", end="")

# Write the new file
with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_lines)

print("\nSuccessfully rewrote server/routes.ts!")
