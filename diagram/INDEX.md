# Diagram Index

All diagrams are Mermaid (`.mmd`) with a white background and one shared green theme.
Ready-to-insert PNG images (white background, high resolution) are in `png/` with the same names.

To edit: paste a `.mmd` file into https://mermaid.live. To re-render: `mmdc -i file.mmd -o file.png -b white -s 2.5`.

## A. Introduction and planning

| File | Diagram | Use in document |
|---|---|---|
| 01_system_overview | System overview (input to alert) | Introduction, Product scope |
| 02_project_methodology | Agile development phases | Methodology |
| 03_gantt_chart | 17-week timeline | Project plan |

## B. System design (SRS section 5.6)

| File | Diagram | SRS section |
|---|---|---|
| 04_use_case_diagram | Use case diagram | 5.6.1 |
| 05_er_diagram | ER diagram | 5.6.2 |
| 06_database_schema | Database schema (all columns) | 5.6.10 |
| 07_system_architecture | Layered architecture | 5.6.3 |
| 08_component_diagram | Component diagram | 5.6.6 |
| 09_class_diagram_domain | Class diagram, data entities | 5.6.8 |
| 10_class_diagram_services | Class diagram, services | 5.6.8 |
| 11_dfd_level0 | Data flow diagram, level 0 | 5.6.9 |
| 12_dfd_level1 | Data flow diagram, level 1 | 5.6.9 |
| 13_activity_image_analysis | Activity diagram, image analysis | 5.6.4 |
| 14_activity_camera_monitoring | Activity diagram, camera monitoring | 5.6.4 |
| 15_sequence_login | Sequence, login and session | 5.6.5 |
| 16_sequence_image_analysis | Sequence, image analysis | 5.6.5 |
| 17_sequence_video_analysis | Sequence, video analysis | 5.6.5 |
| 18_sequence_camera_alert | Sequence, camera monitoring and alerts | 5.6.5 |
| 19_sequence_invite_member | Sequence, invite a member | 5.6.5 |
| 20_state_analysis | State machine, analysis job | 5.6.7 |
| 21_state_camera_worker | State machine, camera worker | 5.6.7 |
| 22_state_alert | State machine, alert | 5.6.7 |
| 23_state_invite | State machine, invite | 5.6.7 |
| 24_alert_engine_flow | Alert rule evaluation flow | Alert module |
| 25_access_control_flow | Authentication and role check flow | Security |
| 26_frontend_sitemap | Website page map | User interface |
| 27_deployment_diagram | Deployment diagram | Operating environment |
| 28_technology_stack | Technology stack | Tools and technologies |

## C. Model development and comparison

| File | Diagram | Use in document |
|---|---|---|
| 29_dataset_preparation | CBVD-5 to YOLO dataset pipeline | Dataset chapter |
| 30_label_priority_rule | One label per cow, priority rule | Dataset chapter |
| 31_data_split_by_video | Train / validation / test split by video | Dataset chapter |
| 32_training_pipeline | Fine-tuning and early stopping | Model training |
| 33_yolo_architecture | YOLO detection pipeline (backbone, neck, head) | Literature / background |
| 34_yolo_version_timeline | YOLO versions timeline | Literature / background |
| 35_model_comparison_workflow | YOLOv8 to YOLO12 comparison workflow | Model comparison |
| 36_fair_comparison_setup | What is fixed and what changes | Model comparison |
| 37_evaluation_metrics | Precision, recall, F1, mAP, speed | Evaluation |
| 38_model_selection_flow | How the final model is chosen | Model comparison |
| 39_model_deployment | Putting the chosen model into the system | Integration |
| 40_single_vs_dual_inference | Single 5-class vs dual posture + state model | Model design |
| 41_testing_strategy | Backend, code, browser and model testing | Testing |

## Notes for the document

- Roles: the built system has two roles, Admin and Member. The SRS lists Administrator, Farm Manager and Farmer. The diagrams follow the built system.
- Backend and database: diagrams show FastAPI and SQLite, not Django and MySQL as written in the SRS.
- Model list in 35 and 36 (YOLOv8s, v9s, v10s, YOLO11s, YOLO12s) and the shared training settings in 36 are editable. Change the node text to match the models you actually train.
- 03_gantt_chart uses placeholder dates; only the week labels (W01 to W17) matter. Change the start date to your real one if needed.
- SMS and email alerts from the SRS are not drawn because they are not implemented.
