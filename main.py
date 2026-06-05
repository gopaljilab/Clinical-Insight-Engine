"""
Entry point for the Clinical Insight Engine Python ML pipeline.

For training and prediction, use analyze.py directly:
  python analyze.py train
  python analyze.py predict_file <path_to_input.json>
"""

import sys
from analyze import save_pretrained_model


def main() -> None:
    print("Training and saving ML model...")
    success = save_pretrained_model()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
